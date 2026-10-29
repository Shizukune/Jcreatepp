using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using Jint;
using Jint.Native;
using Jint.Native.Object;
using Jint.Runtime;

namespace Jcreatepp.Editor.Core
{
    /// <summary>
    /// Runs the Jcreate++ block core (the Web editor's own Blockly + converter + codegen + parts,
    /// without the screen) inside Jint. Uses only Jint, not UnityEngine, so it can be checked outside
    /// Unity (unity/check).
    ///
    /// The core bundle (jcreatepp-core.txt, built by `npm run unity:sim`) defines the global
    /// JcreateppCore; its functions take and return plain values (see src/unityHost/core.ts).
    ///
    /// The core runs only Jcreate++'s own code; the limits are a safety net. When one is hit, or the
    /// core reports that Blockly broke inside, the engine is disposed and <see cref="IsStopped"/>
    /// becomes true; make a new CoreHost to go on.
    /// </summary>
    public sealed class CoreHost : IDisposable
    {
        public sealed class VersionInfo
        {
            public int Format;
            public string Jcreatepp;
            public string Blockly;
            public readonly List<string> BlockTypes = new List<string>();
        }

        public sealed class Warning
        {
            public string Text;
            public string BlockId;
            public string BlockType;
            /// <summary>The event the block is in (the block itself for an event); "" outside any event.</summary>
            public string EventId;
            public string EventType;
            /// <summary>Message name of a receive event; "" otherwise.</summary>
            public string EventMessage;
        }

        public sealed class Variable
        {
            public string Kind;
            public string Name;
            public string StateKey;
        }

        public sealed class ConvertResult
        {
            /// <summary>False when the file was refused (Error says why); nothing else is filled then.</summary>
            public bool Ok;
            public string Error = "";
            public readonly List<string> Errors = new List<string>();
            public readonly List<Warning> Warnings = new List<Warning>();
            /// <summary>The generated Cluster Script; "" when there are conversion errors.</summary>
            public string Code = "";
            /// <summary>What the item needs (src/unitySetup.ts, as JSON); "" when there is no code.</summary>
            public string SetupJson = "";
            public int SizeBytes;
            public string SizeText = "";
            public bool OverCraftItemLimit;
            public readonly List<Variable> Variables = new List<Variable>();
        }

        public sealed class PartParam
        {
            public string Key;
            public string Label;
            /// <summary>"number" or "axis".</summary>
            public string Kind;
            /// <summary>Number as text for "number", X / Y / Z for "axis".</summary>
            public string Default;
            public double Min, Max, Step;
        }

        public sealed class PartInfo
        {
            public string Id;
            public string Label;
            public string Description;
            /// <summary>"single" or "set".</summary>
            public string Size;
            public readonly List<PartParam> Params = new List<PartParam>();
        }

        public sealed class AddPartResult
        {
            public bool Ok;
            public string Error = "";
            /// <summary>The workspace with the part added (.json text).</summary>
            public string Json = "";
        }

        /// <summary>A block editor call's result: <see cref="Json"/> is the answer as JSON text when Ok.</summary>
        public sealed class EditorResult
        {
            public bool Ok;
            public string Error = "";
            public string Json = "";
        }

        /// <summary>
        /// The end of the core module in jcreatepp-core.txt (webpack output). The block editor's entry
        /// is added just before the module closes, where Blockly and the core's register / broken state
        /// are in scope. Only the text given to the engine changes, not the file.
        /// </summary>
        const string ExportLine = "JcreateppCore = __webpack_exports__;";
        const string ModuleEnd = "})();";
        const string EditorEntry =
            "\n;__webpack_exports__.editorAccess = function () { return { " +
            "Blockly: blockly_core__WEBPACK_IMPORTED_MODULE_0__, register: register, " +
            "broken: function () { return brokenReason; }, " +
            "markBroken: function (reason) { if (!brokenReason) brokenReason = reason; } }; };\n";

        /// <summary>Longest the core bundle may take to load (it parses about 1.4 MB).</summary>
        public static readonly TimeSpan LoadTimeout = TimeSpan.FromSeconds(10);
        /// <summary>
        /// Longest one call may take. A call normally takes tens of milliseconds (in Unity 6000.2 too), but with
        /// 2 seconds Unity sometimes stopped calls that were not slow themselves (a pause outside the call, likely
        /// the garbage collector); this is only the safety net for a call that never ends.
        /// </summary>
        public static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(5);
        const long MemoryLimitBytes = 512L * 1024 * 1024;
        const int LargeStackBytes = 64 * 1024 * 1024;
        /// <summary>Blockly reads nested blocks recursively; the core refuses more than 150 levels.</summary>
        const int RecursionLimit = 1000;
        /// <summary>
        /// Jint's JSON.parse stops at 64 levels by default, and a saved workspace nests about 3 levels per
        /// block (block, inputs / next, input): 150 levels of blocks need about 460.
        /// </summary>
        const int JsonParseDepth = 1000;

        sealed class CallTimeLimit : Constraint
        {
            readonly Stopwatch watch = new Stopwatch();
            public TimeSpan Limit;

            public override void Reset()
            {
                watch.Reset();
                watch.Start();
            }

            public override void Check()
            {
                if (watch.Elapsed > Limit) throw new TimeoutException();
            }
        }

        readonly CallTimeLimit timeLimit = new CallTimeLimit();
        Engine engine;
        JsValue versionFn, convertFn, partsFn, addPartFn;
        JsValue paletteFn, shapesFn;
        StackWorker worker;

        public bool IsStopped { get; private set; }
        /// <summary>"" when the block editor calls (<see cref="Palette"/>, <see cref="Shapes"/>) can be used; otherwise why not.</summary>
        public string EditorUnavailableReason { get; private set; }
        public string StopReason { get; private set; }
        /// <summary>How long loading the bundle took (for measuring in Unity).</summary>
        public double LoadMilliseconds { get; private set; }
        /// <summary>How long the latest call took.</summary>
        public double LastCallMilliseconds { get; private set; }

        /// <summary>Creates the engine and runs the core bundle. Throws when the bundle cannot run.</summary>
        public CoreHost(string coreBundle)
        {
            engine = new Engine(options =>
            {
                options.LimitMemory(MemoryLimitBytes);
                options.Constraint(timeLimit);
                options.LimitRecursion(RecursionLimit);
                options.Json.MaxParseDepth = JsonParseDepth;
                // Fixed, not the PC's culture: localeCompare (variable order) and toLocaleString give the same everywhere.
                options.Culture = CultureInfo.GetCultureInfo("ja-JP");
            });
            timeLimit.Limit = LoadTimeout;
            var watch = Stopwatch.StartNew();
            try
            {
                var e = engine;
                var core = OnLargeStack(() => e.Evaluate(WithEditorEntry(coreBundle) + "\n;JcreateppCore;")).AsObject();
                versionFn = core.Get("version");
                convertFn = core.Get("convert");
                partsFn = core.Get("parts");
                addPartFn = core.Get("addPart");
            }
            catch (Exception e)
            {
                Dispose();
                throw new InvalidOperationException("Jcreate++ のブロック処理（jcreatepp-core.txt）を読み込めませんでした。", e);
            }
            LoadEditor();
            LoadMilliseconds = watch.Elapsed.TotalMilliseconds;
        }

        /// <summary>
        /// Runs engine work on this host's own thread, which has a large stack, and waits for it. Blockly reads
        /// nested blocks recursively; 150 levels (the core's limit) overflowed the stack of Unity's main thread
        /// (StackOverflowException in Unity 6000.2; .NET outside Unity has a larger default). One thread for the
        /// host's whole life (not one per call), one call at a time.
        /// </summary>
        T OnLargeStack<T>(Func<T> work)
        {
            if (worker == null) worker = new StackWorker(LargeStackBytes);
            var value = default(T);
            worker.Run(() => { value = work(); });
            return value;
        }

        sealed class StackWorker : IDisposable
        {
            readonly System.Threading.AutoResetEvent go = new System.Threading.AutoResetEvent(false);
            readonly System.Threading.AutoResetEvent done = new System.Threading.AutoResetEvent(false);
            Action work;
            Exception error;
            volatile bool stopping;

            public StackWorker(int stackBytes)
            {
                var thread = new System.Threading.Thread(Loop, stackBytes) { IsBackground = true, Name = "Jcreate++ block core" };
                thread.Start();
            }

            void Loop()
            {
                while (true)
                {
                    go.WaitOne();
                    if (stopping) return;
                    try
                    {
                        work();
                    }
                    catch (Exception e)
                    {
                        error = e;
                    }
                    done.Set();
                }
            }

            public void Run(Action action)
            {
                error = null;
                work = action;
                go.Set();
                done.WaitOne();
                work = null;
                // The same exception object, so the callers' catch blocks (time limit, recursion, memory) still match.
                if (error != null) throw error;
            }

            public void Dispose()
            {
                stopping = true;
                go.Set();
            }
        }

        /// <summary>The bundle with the block editor's entry added; the bundle unchanged when its end does not look as expected.</summary>
        static string WithEditorEntry(string bundle)
        {
            var export = bundle.LastIndexOf(ExportLine, StringComparison.Ordinal);
            if (export < 0) return bundle;
            var end = bundle.LastIndexOf(ModuleEnd, export, StringComparison.Ordinal);
            if (end < 0 || bundle.Substring(end + ModuleEnd.Length, export - end - ModuleEnd.Length).Trim().Length != 0) return bundle;
            return bundle.Substring(0, end) + EditorEntry + bundle.Substring(end);
        }

        /// <summary>Runs <see cref="CoreEditorScript"/>; the converter still works when it cannot.</summary>
        void LoadEditor()
        {
            EditorUnavailableReason = "";
            try
            {
                var e = engine;
                var editor = OnLargeStack(() => e.Evaluate(CoreEditorScript.Source));
                if (editor.IsString())
                {
                    EditorUnavailableReason = editor.AsString();
                    return;
                }
                var o = editor.AsObject();
                paletteFn = o.Get("palette");
                shapesFn = o.Get("shapes");
            }
            catch (Exception e)
            {
                EditorUnavailableReason = "ブロックエディター用の処理を読み込めませんでした: " + e.GetType().Name + ": " + e.Message;
            }
        }

        /// <summary>
        /// The block editor's palette from a toolbox definition (src/toolbox.ts as JSON):
        /// { categories: [{ name, colour, items: [{ kind: label | button | block, text, type, template }] }], types: [names whose shapes are needed] }.
        /// </summary>
        public EditorResult Palette(string toolboxJson)
        {
            // Once per editor window, all palette blocks at once: the load limit, not one call's.
            return CallEditor(paletteFn, toolboxJson ?? "", LoadTimeout);
        }

        /// <summary>The shapes of block types (a JSON array of names): { shapes: { type: shape }, unknown: [names] }.</summary>
        public EditorResult Shapes(string typesJson)
        {
            return CallEditor(shapesFn, typesJson ?? "", LoadTimeout);
        }

        EditorResult CallEditor(JsValue fn, string argument, TimeSpan limit)
        {
            if (!IsStopped && EditorUnavailableReason != "") return new EditorResult { Ok = false, Error = EditorUnavailableReason };
            var value = CallWithin(limit, fn, argument);
            if (value == null) return new EditorResult { Ok = false, Error = StopReason };
            var o = value.AsObject();
            if (StopIfBroken(o)) return new EditorResult { Ok = false, Error = StopReason };
            return new EditorResult { Ok = o.Get("ok").AsBoolean(), Error = o.Get("error").AsString(), Json = o.Get("json").AsString() };
        }

        /// <summary>The core's version and the block types it knows; null when stopped.</summary>
        public VersionInfo Version()
        {
            var value = Call(versionFn);
            if (value == null) return null;
            var o = value.AsObject();
            var v = new VersionInfo
            {
                Format = (int)o.Get("format").AsNumber(),
                Jcreatepp = o.Get("jcreatepp").AsString(),
                Blockly = o.Get("blockly").AsString(),
            };
            foreach (var t in Items(o.Get("blockTypes"))) v.BlockTypes.Add(t.AsString());
            return v;
        }

        /// <summary>A saved workspace (.json text) → what the Web editor shows for it.</summary>
        public ConvertResult Convert(string json)
        {
            var value = Call(convertFn, json ?? "");
            if (value == null) return new ConvertResult { Ok = false, Error = StopReason };
            var o = value.AsObject();
            if (StopIfBroken(o)) return new ConvertResult { Ok = false, Error = StopReason };
            var r = new ConvertResult
            {
                Ok = o.Get("ok").AsBoolean(),
                Error = o.Get("error").AsString(),
                Code = o.Get("code").AsString(),
                SetupJson = o.Get("setupJson").AsString(),
            };
            foreach (var e in Items(o.Get("errors"))) r.Errors.Add(e.AsString());
            foreach (var w in Items(o.Get("warnings")))
            {
                var x = w.AsObject();
                r.Warnings.Add(new Warning
                {
                    Text = x.Get("text").AsString(),
                    BlockId = x.Get("blockId").AsString(),
                    BlockType = x.Get("blockType").AsString(),
                    EventId = x.Get("eventId").AsString(),
                    EventType = x.Get("eventType").AsString(),
                    EventMessage = x.Get("eventMessage").AsString(),
                });
            }
            var size = o.Get("size").AsObject();
            r.SizeBytes = (int)size.Get("bytes").AsNumber();
            r.SizeText = size.Get("text").AsString();
            r.OverCraftItemLimit = size.Get("overLimit").AsBoolean();
            foreach (var v in Items(o.Get("variables")))
            {
                var x = v.AsObject();
                r.Variables.Add(new Variable { Kind = x.Get("kind").AsString(), Name = x.Get("name").AsString(), StateKey = x.Get("stateKey").AsString() });
            }
            return r;
        }

        /// <summary>The parts that can be added; null when stopped.</summary>
        public List<PartInfo> Parts()
        {
            var value = Call(partsFn);
            if (value == null) return null;
            var list = new List<PartInfo>();
            foreach (var p in Items(value))
            {
                var o = p.AsObject();
                var info = new PartInfo
                {
                    Id = o.Get("id").AsString(),
                    Label = o.Get("label").AsString(),
                    Description = o.Get("description").AsString(),
                    Size = o.Get("size").AsString(),
                };
                foreach (var q in Items(o.Get("params")))
                {
                    var x = q.AsObject();
                    var kind = x.Get("kind").AsString();
                    var param = new PartParam
                    {
                        Key = x.Get("key").AsString(),
                        Label = x.Get("label").AsString(),
                        Kind = kind,
                        Default = TypeConverter.ToString(x.Get("default")),
                    };
                    if (kind == "number")
                    {
                        param.Min = x.Get("min").AsNumber();
                        param.Max = x.Get("max").AsNumber();
                        param.Step = x.Get("step").AsNumber();
                    }
                    info.Params.Add(param);
                }
                list.Add(info);
            }
            return list;
        }

        /// <summary>
        /// Adds a part like the Web parts tab. <paramref name="valuesJson"/> is a JSON object of parameter
        /// values ("" = defaults; numbers outside the range are clamped like the form).
        /// </summary>
        public AddPartResult AddPart(string json, string partId, string valuesJson)
        {
            var value = Call(addPartFn, json ?? "", partId ?? "", valuesJson ?? "");
            if (value == null) return new AddPartResult { Ok = false, Error = StopReason };
            var o = value.AsObject();
            if (StopIfBroken(o)) return new AddPartResult { Ok = false, Error = StopReason };
            return new AddPartResult { Ok = o.Get("ok").AsBoolean(), Error = o.Get("error").AsString(), Json = o.Get("json").AsString() };
        }

        bool StopIfBroken(ObjectInstance result)
        {
            if (!result.Get("broken").AsBoolean()) return false;
            Stop(result.Get("error").AsString());
            return true;
        }

        JsValue Call(JsValue fn, params object[] args)
        {
            return CallWithin(CallTimeout, fn, args);
        }

        JsValue CallWithin(TimeSpan limit, JsValue fn, params object[] args)
        {
            if (IsStopped || engine == null) return null;
            timeLimit.Limit = limit;
            var watch = Stopwatch.StartNew();
            try
            {
                var e = engine;
                return OnLargeStack(() => e.Invoke(fn, args));
            }
            catch (TimeoutException)
            {
                Stop("ブロックの処理が " + limit.TotalSeconds + " 秒以上かかったので止めました。ブロックが多すぎるかもしれません。");
            }
            catch (RecursionDepthOverflowException)
            {
                Stop("ブロックの入れ子が深すぎて処理できませんでした。");
            }
            catch (MemoryLimitExceededException)
            {
                Stop("ブロックの処理でメモリを使いすぎたので止めました。");
            }
            catch (Exception e)
            {
                // The core does not throw by contract; anything here is unexpected.
                Stop("ブロックの処理を続けられなくなりました: " + e.GetType().Name + ": " + e.Message);
            }
            finally
            {
                LastCallMilliseconds = watch.Elapsed.TotalMilliseconds;
            }
            return null;
        }

        void Stop(string reason)
        {
            StopReason = reason;
            Dispose();
        }

        static IEnumerable<JsValue> Items(JsValue array)
        {
            if (array == null || !array.IsArray()) yield break;
            var a = array.AsArray();
            for (uint i = 0; i < a.Length; i++) yield return a[i];
        }

        public void Dispose()
        {
            IsStopped = true;
            if (StopReason == null) StopReason = "ブロック処理は終了しています。";
            versionFn = convertFn = partsFn = addPartFn = paletteFn = shapesFn = null;
            if (engine != null)
            {
                engine.Dispose();
                engine = null;
            }
            if (worker != null)
            {
                worker.Dispose();
                worker = null;
            }
        }
    }
}
