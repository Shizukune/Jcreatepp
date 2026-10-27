using System;
using System.Collections.Generic;
using System.Diagnostics;
using Jint;
using Jint.Native;
using Jint.Runtime;

namespace Jcreatepp.Editor.Preview
{
    /// <summary>
    /// Runs a Cluster Script on the Jcreate++ simulator (the same one as the Web preview) inside Jint.
    /// Uses only Jint, not UnityEngine, so it can be checked outside Unity (unity/check).
    ///
    /// The simulator bundle (jcreatepp-sim.txt, built by `npm run unity:sim`) defines the global
    /// JcreateppHost; its functions take and return plain values (see src/unityHost/host.ts).
    ///
    /// Errors in the script itself are logged by the simulator and the preview goes on.
    /// When Jint's limits are hit (a script that never ends, too deep recursion, too much memory) or
    /// anything else goes wrong, the engine is disposed and <see cref="IsStopped"/> becomes true;
    /// make a new SimHost to start over.
    /// </summary>
    public sealed class SimHost : IDisposable
    {
        public sealed class StateRow
        {
            public string Kind;
            public string Group;
            public string Name;
            public string Text;
        }

        public sealed class LogLine
        {
            public double Time;
            public string Kind;
            public string Text;
        }

        public sealed class Snapshot
        {
            public double Time;
            public double[] Position = new double[3];
            public double[] Rotation = new double[4];
            public double[] Euler = new double[3];
            public readonly List<string> Events = new List<string>();
            public readonly List<StateRow> State = new List<StateRow>();
            /// <summary>Log lines added since the previous snapshot, oldest first.</summary>
            public readonly List<LogLine> Log = new List<LogLine>();
            public string LastError = "";
            public readonly List<string> Unsupported = new List<string>();
        }

        /// <summary>Longest the simulator bundle or a Load may take (they parse and run more code).</summary>
        public static readonly TimeSpan SetupTimeout = TimeSpan.FromSeconds(2);
        /// <summary>Longest one Step / Fire / TakeSnapshot may take (the editor waits for it).</summary>
        public static readonly TimeSpan CallTimeout = TimeSpan.FromSeconds(0.25);
        const long MemoryLimitBytes = 256L * 1024 * 1024;
        const int RecursionLimit = 256;

        /// <summary>Jint's own time limit is fixed per engine; this one is set before each call.</summary>
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
        JsValue loadFn, stepFn, fireFn, snapshotFn;

        public bool IsStopped { get; private set; }
        public string StopReason { get; private set; }
        /// <summary>A script error that escaped the simulator in the last call (the host keeps running).</summary>
        public string LastCallError { get; private set; }

        /// <summary>Creates the engine and runs the simulator bundle. Throws when the bundle cannot run.</summary>
        public SimHost(string simulatorBundle)
        {
            engine = new Engine(options =>
            {
                options.LimitMemory(MemoryLimitBytes);
                options.Constraint(timeLimit);
                options.LimitRecursion(RecursionLimit);
            });
            timeLimit.Limit = SetupTimeout;

            var setupStep = "simulator execution";
            try
            {
                var hostValue = engine.Evaluate(simulatorBundle + "\n;JcreateppHost;");
                setupStep = "JcreateppHost evaluation result";
                var host = hostValue.AsObject();
                setupStep = "host function lookup";
                loadFn = host.Get("load");
                stepFn = host.Get("step");
                fireFn = host.Get("fire");
                snapshotFn = host.Get("snapshot");
            }
            catch (Exception e)
            {
                Dispose();
                throw new InvalidOperationException("Preview initialization failed at " + setupStep + ": " + e.ToString(), e);
            }
        }

        /// <summary>
        /// Loads a script at the given start pose and runs its 開始時 (onStart).
        /// Returns "" when the script runs, otherwise why it cannot.
        /// </summary>
        public string Load(string code, double[] position, double[] rotation)
        {
            var result = Call(SetupTimeout, loadFn, code, position[0], position[1], position[2], rotation[0], rotation[1], rotation[2], rotation[3]);
            if (result == null) return IsStopped ? StopReason : LastCallError;
            var obj = result.AsObject();
            return obj.Get("ok").AsBoolean() ? "" : obj.Get("error").AsString();
        }

        public void Step(double dt)
        {
            Call(CallTimeout, stepFn, dt);
        }

        /// <summary>interact / grab / release / collide / receive (message and typed value for receive).</summary>
        public void Fire(string name, string message, string value)
        {
            Call(CallTimeout, fireFn, name, message ?? "", value ?? "");
        }

        /// <summary>The current state, or null before a successful Load or after the host stopped.</summary>
        public Snapshot TakeSnapshot()
        {
            var value = Call(CallTimeout, snapshotFn);
            if (value == null || value.IsNull() || value.IsUndefined()) return null;
            var o = value.AsObject();
            var s = new Snapshot();
            s.Time = o.Get("time").AsNumber();
            ReadNumbers(o.Get("position"), s.Position);
            ReadNumbers(o.Get("rotation"), s.Rotation);
            ReadNumbers(o.Get("euler"), s.Euler);
            foreach (var e in Items(o.Get("events"))) s.Events.Add(e.AsString());
            foreach (var r in Items(o.Get("state")))
            {
                var row = r.AsObject();
                s.State.Add(new StateRow
                {
                    Kind = row.Get("kind").AsString(),
                    Group = row.Get("group").AsString(),
                    Name = row.Get("name").AsString(),
                    Text = row.Get("text").AsString(),
                });
            }
            foreach (var l in Items(o.Get("log")))
            {
                var line = l.AsObject();
                s.Log.Add(new LogLine
                {
                    Time = line.Get("time").AsNumber(),
                    Kind = line.Get("kind").AsString(),
                    Text = line.Get("text").AsString(),
                });
            }
            s.LastError = o.Get("lastError").AsString();
            foreach (var u in Items(o.Get("unsupported"))) s.Unsupported.Add(u.AsString());
            return s;
        }

        /// <summary>Calls a JcreateppHost function (they do not use `this`). Null when the host is stopped.</summary>
        JsValue Call(TimeSpan limit, JsValue fn, params object[] args)
        {
            if (IsStopped || engine == null) return null;
            LastCallError = "";
            timeLimit.Limit = limit;
            try
            {
                return engine.Invoke(fn, args);
            }
            catch (JavaScriptException e)
            {
                // A script error that escaped the simulator: report it, keep going.
                LastCallError = "スクリプトのエラー: " + e.Message;
                return null;
            }
            catch (TimeoutException)
            {
                Stop("処理が " + limit.TotalSeconds + " 秒以上かかったので止めました（終わらないくり返しがあるかもしれません）。「最初から」でやり直せます。");
            }
            catch (RecursionDepthOverflowException)
            {
                Stop("呼び出しが深くなりすぎたので止めました（自分自身を呼び続けているかもしれません）。「最初から」でやり直せます。");
            }
            catch (MemoryLimitExceededException)
            {
                Stop("メモリを使いすぎたので止めました。「最初から」でやり直せます。");
            }
            catch (Exception e)
            {
                Stop("プレビューを続けられなくなりました: " + e.GetType().Name + ": " + e.Message);
            }
            return null;
        }

        void Stop(string reason)
        {
            StopReason = reason;
            Dispose();
        }

        static void ReadNumbers(JsValue array, double[] into)
        {
            var i = 0;
            foreach (var v in Items(array))
            {
                if (i >= into.Length) break;
                into[i++] = v.AsNumber();
            }
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
            loadFn = stepFn = fireFn = snapshotFn = null;
            if (engine != null)
            {
                engine.Dispose();
                engine = null;
            }
        }
    }
}
