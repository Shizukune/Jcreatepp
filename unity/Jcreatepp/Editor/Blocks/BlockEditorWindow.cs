using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using ClusterVR.CreatorKit.Item.Implements;
using Jcreatepp.Editor.Core;
using Jcreatepp.Editor.Preview;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>
    /// メニュー「Jcreate++ > ブロックエディター」。Web 版と同じブロックを、Unity のウィンドウの中で並べて
    /// つなげ、Cluster Script を作る。ブロックの形・変換・警告・コード生成は Web 版の処理（CoreHost）がそのまま
    /// 行い、保存するファイルも Web 版と同じ形（.json）。
    /// 左: パレット（ドラッグで置く） / 中: ブロックを置く場所 / 右: 変換の結果・プレビュー・オブジェクトへの設定。
    /// </summary>
    public sealed class BlockEditorWindow : EditorWindow
    {
        const float ToolbarHeight = 21;
        const float PaletteWidth = 250;
        const float ResultWidth = 340;
        const float SnapRadius = 28;
        const float DragThreshold = 4;
        const double ConvertDelay = 0.3;
        const string SaveFolder = "Assets/Jcreatepp Scripts";
        const string PartsCallback = "jppOpenParts";
        const string ToolboxMarker = "\"categoryToolbox\"";

        static readonly Color CanvasColour = new Color(0.17f, 0.17f, 0.18f);
        static readonly Color GridColour = new Color(1, 1, 1, 0.04f);
        static readonly Color SelectColour = new Color(1f, 0.85f, 0.2f);
        static readonly Color WarnColour = new Color(1f, 0.55f, 0.1f);
        static readonly Color TargetColour = new Color(1f, 1f, 1f, 0.9f);
        static readonly string[] Axes = { "X", "Y", "Z" };

        [SerializeField] BlockEditorState state;
        [SerializeField] Vector2 pan = new Vector2(40, 40);
        [SerializeField] int category = 1;
        [SerializeField] Vector2 paletteScroll;
        [SerializeField] Vector2 resultScroll;
        [SerializeField] string selectedId = "";
        [SerializeField] bool autoPreview = true;
        [SerializeField] bool showCode = true;
        [SerializeField] bool showSetup = true;

        CoreHost core;
        BlockCatalog catalog;
        /// <summary>Why the editor cannot be used (the core or palette did not load); "" when fine.</summary>
        string problem = "";
        /// <summary>Loading failed: not tried again until 読み込み直す (loading takes about a second).</summary>
        bool loadFailed;
        BlockWorkspace ws;
        string wsJson;
        BlockLayout layout;
        LayoutResult canvasLayout;
        Rect canvasRect, paletteRect, resultRect;
        Vector2 windowMouse;

        CoreHost.ConvertResult result;
        string resultJson;
        bool convertPending;
        double convertAt;
        readonly HashSet<string> warned = new HashSet<string>();

        // Dragging: a press on a block first waits (a click selects), then becomes a drag.
        BlockNode pending;
        Vector2 pendingAt, grabOffset;
        BlockNode dragging;
        bool dragFromPalette;
        Connection target;
        bool panning;

        readonly Dictionary<PaletteItem, BlockNode> paletteBlocks = new Dictionary<PaletteItem, BlockNode>();
        readonly List<KeyValuePair<PaletteItem, Rect>> paletteHits = new List<KeyValuePair<PaletteItem, Rect>>();
        List<CoreHost.PartInfo> parts;
        readonly Dictionary<string, Dictionary<string, string>> partValues = new Dictionary<string, Dictionary<string, string>>();
        ItemSetup.Result applyResult;
        GameObject applyTarget;
        string notice = "";
        /// <summary>.js files this window wrote → the text written; overwritten again without asking only while the file still has that text.</summary>
        readonly Dictionary<string, string> written = new Dictionary<string, string>();

        GUIStyle blockLabel, fieldText, fieldPopup, smallWrap;
        readonly Dictionary<string, float> widths = new Dictionary<string, float>();
        readonly Dictionary<string, Color> colours = new Dictionary<string, Color>();

        [MenuItem("Jcreate++/ブロックエディター", false, -10)]
        public static void Open()
        {
            var window = GetWindow<BlockEditorWindow>();
            window.titleContent = new GUIContent("Jcreate++ ブロック");
            window.minSize = new Vector2(820, 420);
            window.Show();
        }

        /// <summary>Opens a saved workspace (.json) in the editor.</summary>
        public static void OpenFile(string path)
        {
            Open();
            var window = GetWindow<BlockEditorWindow>();
            if (window.ConfirmDiscard()) window.Load(path);
        }

        /// <summary>Double-clicking a Jcreate++ block file (.json) in the Project window opens it here.</summary>
        [OnOpenAsset(0)]
        static bool OnOpenAsset(int instanceId, int line)
        {
            var path = AssetDatabase.GetAssetPath(instanceId);
            if (string.IsNullOrEmpty(path) || !path.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) return false;
            var asset = EditorUtility.InstanceIDToObject(instanceId) as TextAsset;
            if (asset == null || !asset.text.Contains("\"jcreatepp_")) return false;
            OpenFile(path);
            return true;
        }

        void OnEnable()
        {
            if (state == null)
            {
                state = CreateInstance<BlockEditorState>();
                state.hideFlags = HideFlags.HideAndDontSave;
            }
            titleContent = new GUIContent("Jcreate++ ブロック");
            // Tooltips on palette blocks need repaints while the mouse moves.
            wantsMouseMove = true;
            Undo.undoRedoPerformed += OnUndoRedo;
            EditorApplication.update += Tick;
            AssemblyReloadEvents.beforeAssemblyReload += DisposeCore;
            ws = null;
            ScheduleConvert();
        }

        void OnDisable()
        {
            Undo.undoRedoPerformed -= OnUndoRedo;
            EditorApplication.update -= Tick;
            AssemblyReloadEvents.beforeAssemblyReload -= DisposeCore;
            DisposeCore();
        }

        void OnDestroy()
        {
            if (state != null && HasUnsavedChanges() &&
                EditorUtility.DisplayDialog("Jcreate++", "ブロックの変更が保存されていません。保存しますか？", "保存する", "保存しない"))
            {
                Save(false);
            }
            if (state != null) DestroyImmediate(state);
        }

        void OnLostFocus()
        {
            CancelDrag();
        }

        void DisposeCore()
        {
            if (core != null) core.Dispose();
            core = null;
        }

        // ── Core and workspace ──────────────────────────────────────────

        /// <summary>Loads the block core and the palette once (about a second); false (problem set) when it cannot.</summary>
        bool EnsureCore()
        {
            if (core != null && !core.IsStopped && catalog != null) return true;
            if (loadFailed) return false;
            if (core != null && core.IsStopped)
            {
                // The core stops itself when something went wrong inside; a new one is made and editing goes on.
                notice = core.StopReason + "（ブロック処理を読み込み直しました）";
                core.Dispose();
                core = null;
            }
            if (!LoadCore())
            {
                loadFailed = true;
                DisposeCore();
                return false;
            }
            problem = "";
            ws = null;
            return true;
        }

        bool LoadCore()
        {
            var bundle = CoreBundle.Load();
            if (bundle == null)
            {
                problem = "ブロック処理（jcreatepp-core.txt）が見つかりません。Jcreatepp フォルダを丸ごと入れ直してください。";
                return false;
            }
            var toolbox = LoadToolbox();
            if (toolbox == null)
            {
                problem = "パレットの定義（jcreatepp-toolbox.json）が見つかりません。Jcreatepp フォルダを丸ごと入れ直してください。";
                return false;
            }
            try
            {
                core = new CoreHost(bundle);
            }
            catch (Exception e)
            {
                problem = e.Message + (e.InnerException != null ? "（" + e.InnerException.Message + "）" : "");
                return false;
            }
            if (core.EditorUnavailableReason != "")
            {
                problem = core.EditorUnavailableReason;
                return false;
            }
            string error;
            var loaded = BlockCatalog.Load(core, toolbox, out error);
            if (loaded == null)
            {
                problem = "パレットを作れませんでした: " + error;
                return false;
            }
            catalog = loaded;
            layout = new BlockLayout(catalog, Measure);
            paletteBlocks.Clear();
            parts = core.Parts();
            return true;
        }

        static string LoadToolbox()
        {
            foreach (var guid in AssetDatabase.FindAssets("jcreatepp-toolbox t:TextAsset"))
            {
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (asset != null && asset.text.Contains(ToolboxMarker)) return asset.text;
            }
            return null;
        }

        /// <summary>The workspace being edited, read again from <see cref="BlockEditorState"/> after Undo / Redo / reload.</summary>
        BlockWorkspace Workspace()
        {
            if (ws != null && wsJson == state.Json) return ws;
            try
            {
                ws = state.Json == "" ? new BlockWorkspace() : BlockWorkspace.FromJson(state.Json);
            }
            catch (FormatException e)
            {
                problem = "ブロックを読めませんでした: " + e.Message;
                ws = new BlockWorkspace();
            }
            wsJson = state.Json;
            LoadMissingShapes(ws);
            return ws;
        }

        void LoadMissingShapes(BlockWorkspace w)
        {
            if (catalog == null || core == null) return;
            var types = new List<string>();
            foreach (var b in w.All())
            {
                if (!catalog.Knows(b.Type) && !types.Contains(b.Type)) types.Add(b.Type);
            }
            string error;
            if (types.Count > 0 && !catalog.LoadShapes(core, types, out error)) problem = error;
        }

        /// <summary>Records the workspace as one Undo step and converts it again shortly.</summary>
        void Commit(string what)
        {
            Undo.IncrementCurrentGroup();
            Undo.RecordObject(state, "Jcreate++ ブロック: " + what);
            state.Json = ws.Tops.Count == 0 ? "" : ws.ToJson(false);
            state.Dirty = true;
            wsJson = state.Json;
            ScheduleConvert();
            Repaint();
        }

        void OnUndoRedo()
        {
            if (state == null || state.Json == wsJson) return;
            CancelDrag();
            ws = null;
            ScheduleConvert();
            Repaint();
        }

        void ScheduleConvert()
        {
            convertPending = true;
            convertAt = EditorApplication.timeSinceStartup + ConvertDelay;
        }

        void Tick()
        {
            if (convertPending && EditorApplication.timeSinceStartup >= convertAt && dragging == null) RunConvert();
        }

        /// <summary>Converts the workspace like the Web editor (errors, warnings, code, what the item needs).</summary>
        void RunConvert()
        {
            convertPending = false;
            if (!EnsureCore()) return;
            var json = state.Json == "" ? "{}" : state.Json;
            if (result != null && resultJson == json) return;
            result = core.Convert(json);
            resultJson = json;
            warned.Clear();
            foreach (var w in result.Warnings) warned.Add(w.BlockId);
            if (core.IsStopped)
            {
                notice = core.StopReason;
                resultJson = null;
            }
            SyncPreview();
            Repaint();
        }

        /// <summary>
        /// Tells an open preview of the block code about the latest conversion: it starts again with the new code
        /// (when 自動でやり直す is on), or keeps the code it has and says why that is not the blocks now.
        /// </summary>
        void SyncPreview()
        {
            if (result == null) return;
            var code = result.Ok ? result.Code : "";
            string reason;
            if (!result.Ok) reason = result.Error;
            else if (result.Errors.Count > 0) reason = "ブロックにまちがいがあるので、新しいコードを作れません。";
            else if (code == "") reason = "コードを作れるブロックがありません。";
            else reason = "「ブロックを変えたら、開いているプレビューもやり直す」がオフです。";
            PreviewWindow.SyncBlockCode(code, autoPreview, reason);
        }

        bool ConvertedNow()
        {
            if (convertPending || result == null || resultJson != (state.Json == "" ? "{}" : state.Json))
            {
                resultJson = null;
                RunConvert();
            }
            return result != null;
        }

        // ── Files ───────────────────────────────────────────────────────

        string FileName
        {
            get { return state.AssetPath != "" ? Path.GetFileName(state.AssetPath) : "（まだ保存していません）"; }
        }

        void New()
        {
            if (!ConfirmDiscard()) return;
            Undo.RecordObject(state, "Jcreate++ ブロック: 新規");
            state.Json = "";
            state.AssetPath = "";
            state.Dirty = false;
            ws = null;
            selectedId = "";
            applyResult = null;
            ScheduleConvert();
        }

        /// <summary>
        /// Changed since the last save or open. Emptying a saved file counts (the file still has blocks);
        /// an empty workspace that was never saved has nothing to keep.
        /// </summary>
        bool HasUnsavedChanges()
        {
            return state.Dirty && !(state.Json == "" && state.AssetPath == "");
        }

        bool ConfirmDiscard()
        {
            if (!HasUnsavedChanges()) return true;
            var choice = EditorUtility.DisplayDialogComplex("Jcreate++", "ブロックの変更が保存されていません。", "保存する", "やめる", "保存しない");
            if (choice == 1) return false;
            if (choice == 0) return Save(false);
            return true;
        }

        void PickAndLoad()
        {
            if (!ConfirmDiscard()) return;
            var start = state.AssetPath != "" ? Path.GetDirectoryName(state.AssetPath) : (AssetDatabase.IsValidFolder(SaveFolder) ? SaveFolder : "Assets");
            var path = EditorUtility.OpenFilePanel("Jcreate++ のブロックを開く（Web 版で保存した .json も開けます）", start, "json");
            if (string.IsNullOrEmpty(path)) return;
            Load(path);
        }

        void Load(string path)
        {
            if (!EnsureCore())
            {
                EditorUtility.DisplayDialog("Jcreate++", problem, "OK");
                return;
            }
            string text;
            try
            {
                text = File.ReadAllText(path, Encoding.UTF8);
            }
            catch (Exception e)
            {
                EditorUtility.DisplayDialog("Jcreate++", "ファイルを読めませんでした: " + e.Message, "OK");
                return;
            }
            BlockWorkspace loaded;
            try
            {
                loaded = BlockWorkspace.FromJson(text);
            }
            catch (FormatException e)
            {
                EditorUtility.DisplayDialog("Jcreate++", "Jcreate++ のブロックのファイルではないようです: " + e.Message, "OK");
                return;
            }
            // The same check as the Web editor's converter (unknown blocks, size, depth).
            var check = core.Convert(text);
            if (!check.Ok)
            {
                EditorUtility.DisplayDialog("Jcreate++", "このファイルは開けません: " + check.Error, "OK");
                if (core.IsStopped) EnsureCore();
                return;
            }
            Undo.RecordObject(state, "Jcreate++ ブロック: 開く");
            state.Json = loaded.Tops.Count == 0 ? "" : loaded.ToJson(false);
            var assetPath = ToAssetPath(path);
            state.AssetPath = assetPath ?? "";
            state.Dirty = assetPath == null;
            ws = null;
            selectedId = "";
            applyResult = null;
            notice = assetPath == null ? "プロジェクトの外のファイルを開きました。保存するときはプロジェクトの中に保存します。" : "";
            ScheduleConvert();
            FitView();
            Repaint();
        }

        /// <summary>Saves the blocks (.json, the Web editor's format). False when not saved.</summary>
        bool Save(bool choosePlace)
        {
            var path = state.AssetPath;
            if (choosePlace || path == "")
            {
                if (!AssetDatabase.IsValidFolder(SaveFolder)) AssetDatabase.CreateFolder("Assets", Path.GetFileName(SaveFolder));
                var folder = path != "" ? Path.GetDirectoryName(path) : SaveFolder;
                var name = path != "" ? Path.GetFileNameWithoutExtension(path) : "jcreatepp_blocks";
                path = EditorUtility.SaveFilePanelInProject("Jcreate++ のブロックを保存", name, "json",
                    "ブロックのファイル（.json）の保存先を選んでください。Web 版の「読み込み」でも開けます。", folder);
                if (string.IsNullOrEmpty(path)) return false;
            }
            var w = Workspace();
            WriteText(path, w.ToJson(true) + "\n");
            AssetDatabase.ImportAsset(path);
            state.AssetPath = path;
            state.Dirty = false;
            notice = "保存しました: " + path;
            Repaint();
            return true;
        }

        static void WriteText(string assetPath, string text)
        {
            var full = Path.Combine(Path.GetDirectoryName(Application.dataPath), assetPath);
            File.WriteAllText(full, text, new UTF8Encoding(false));
        }

        /// <summary>Writes the generated code next to the saved blocks (same name, .js) and returns it as a JavaScript Asset; null when not done.</summary>
        JavaScriptAsset WriteScript()
        {
            if (!ConvertedNow() || !result.Ok || result.Code == "")
            {
                EditorUtility.DisplayDialog("Jcreate++", result != null && result.Errors.Count > 0
                    ? "ブロックにまちがいがあるので、コードを作れません。右の「変換できないところ」を直してください。"
                    : "コードを作れるブロックがありません。イベント（開始時 など）のブロックを置いて、中に動作をつなげてください。", "OK");
                return null;
            }
            if (state.AssetPath == "" || state.Dirty)
            {
                if (!Save(false)) return null;
            }
            var jsPath = Path.ChangeExtension(state.AssetPath, ".js").Replace('\\', '/');
            var full = Path.Combine(Path.GetDirectoryName(Application.dataPath), jsPath);
            if (File.Exists(full))
            {
                // Asks unless the file is what this window wrote last time (not edited since) or already the new code.
                var current = File.ReadAllText(full, Encoding.UTF8);
                string last;
                var ours = written.TryGetValue(jsPath, out last) && last == current;
                if (!ours && current != result.Code &&
                    !EditorUtility.DisplayDialog("Jcreate++", "「" + jsPath + "」はもうあります" + (written.ContainsKey(jsPath) ? "（前に書き出したあとで変更されています）" : "") +
                        "。ブロックから作ったコードで上書きしますか？", "上書きする", "やめる"))
                {
                    return null;
                }
            }
            WriteText(jsPath, result.Code);
            written[jsPath] = result.Code;
            // CCK's importer turns the .js into a JavaScriptAsset.
            AssetDatabase.ImportAsset(jsPath, ImportAssetOptions.ForceUpdate);
            var asset = AssetDatabase.LoadAssetAtPath<JavaScriptAsset>(jsPath);
            if (asset == null)
            {
                EditorUtility.DisplayDialog("Jcreate++", "「" + jsPath + "」を JavaScript Asset として読み込めませんでした。Cluster Creator Kit が入っているか確認してください。", "OK");
            }
            return asset;
        }

        void ApplyToSelection()
        {
            var go = Selection.activeGameObject;
            if (go == null || EditorUtility.IsPersistent(go))
            {
                EditorUtility.DisplayDialog("Jcreate++", "先にヒエラルキーで、スクリプトを付けるオブジェクトを選んでください。", "OK");
                return;
            }
            var asset = WriteScript();
            if (asset == null) return;
            applyResult = ItemSetup.Apply(go, asset);
            applyTarget = go;
            notice = "「" + go.name + "」に設定しました（" + AssetDatabase.GetAssetPath(asset) + "）。元に戻す: Ctrl+Z";
        }

        static string ToAssetPath(string fullPath)
        {
            var dataPath = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
            var full = Path.GetFullPath(fullPath).Replace('\\', '/');
            if (!full.StartsWith(dataPath + "/")) return null;
            return "Assets" + full.Substring(dataPath.Length);
        }

        // ── Editing ─────────────────────────────────────────────────────

        BlockNode Selected()
        {
            return ws == null ? null : ws.Find(selectedId);
        }

        void DeleteBlock(BlockNode b, bool withBelow)
        {
            if (b == null || b.IsShadow || Workspace().Find(b.Id) != b) return;
            if (withBelow) ws.Detach(b);
            else ws.DetachHealing(b, catalog);
            ws.Relink();
            selectedId = "";
            Commit("削除");
        }

        void Duplicate(BlockNode b)
        {
            if (b == null || b.IsShadow || Workspace().Find(b.Id) != b) return;
            var box = canvasLayout != null && canvasLayout.ByNode.ContainsKey(b) ? canvasLayout.ByNode[b].Box : new Box((float)b.X, (float)b.Y, 0, 0);
            var copy = ws.Copy(b, false);
            ws.AddTop(copy, box.X + 24, box.Y + 24);
            selectedId = copy.Id;
            Commit("複製");
        }

        /// <summary>Lines the stacks up from the top left, in their current order (top to bottom).</summary>
        void CleanUp()
        {
            var tops = new List<BlockNode>(ws.Tops);
            tops.Sort((a, b) => a.Y != b.Y ? a.Y.CompareTo(b.Y) : a.X.CompareTo(b.X));
            double y = 20;
            foreach (var t in tops)
            {
                t.X = 20;
                t.Y = y;
                y += layout.SizeOfChain(t).H + 24;
            }
            Commit("整列");
            pan = new Vector2(20, 20);
        }

        void SetField(BlockNode b, FieldShape f, object value)
        {
            b.Fields[f.Name] = value;
            Commit("値を変える");
        }

        void Reveal(string blockId)
        {
            selectedId = blockId;
            if (canvasLayout == null) return;
            var b = ws.Find(blockId);
            BlockBox box;
            if (b == null || !canvasLayout.ByNode.TryGetValue(b, out box)) return;
            pan = new Vector2(40 - box.Box.X, 60 - box.Box.Y);
            Repaint();
        }

        void FitView()
        {
            var w = Workspace();
            if (w.Tops.Count == 0 || layout == null)
            {
                pan = new Vector2(40, 40);
                return;
            }
            var bounds = layout.Layout(w.Tops).Bounds;
            pan = new Vector2(30 - bounds.X, 30 - bounds.Y);
        }

        // ── Drawing helpers ─────────────────────────────────────────────

        void InitStyles()
        {
            if (blockLabel != null) return;
            blockLabel = new GUIStyle(EditorStyles.boldLabel) { fontSize = 11, alignment = TextAnchor.MiddleLeft, padding = new RectOffset(0, 0, 0, 0), margin = new RectOffset(0, 0, 0, 0) };
            blockLabel.normal.textColor = Color.white;
            fieldText = new GUIStyle(EditorStyles.textField) { fontSize = 11, alignment = TextAnchor.MiddleCenter, padding = new RectOffset(3, 3, 1, 1) };
            fieldText.normal.textColor = new Color(0.1f, 0.1f, 0.1f);
            fieldText.focused.textColor = new Color(0.1f, 0.1f, 0.1f);
            fieldText.normal.background = Texture2D.whiteTexture;
            fieldText.focused.background = Texture2D.whiteTexture;
            fieldPopup = new GUIStyle(EditorStyles.popup) { fontSize = 11, fixedHeight = 0 };
            smallWrap = new GUIStyle(EditorStyles.miniLabel) { wordWrap = true };
        }

        float Measure(string text)
        {
            InitStyles();
            float w;
            if (widths.TryGetValue(text, out w)) return w;
            w = blockLabel.CalcSize(new GUIContent(text)).x;
            widths[text] = w;
            return w;
        }

        Color ColourOf(string hex)
        {
            Color c;
            if (colours.TryGetValue(hex, out c)) return c;
            if (!ColorUtility.TryParseHtmlString(hex, out c)) c = Color.gray;
            colours[hex] = c;
            return c;
        }

        static void Fill(Rect r, Color c, float radius)
        {
            GUI.DrawTexture(r, Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0, c, 0, radius);
        }

        static void Outline(Rect r, Color c, float width, float radius)
        {
            GUI.DrawTexture(r, Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0, c, width, radius);
        }

        static Rect ToRect(Box b, Vector2 offset)
        {
            return new Rect(b.X + offset.x, b.Y + offset.y, b.W, b.H);
        }

        /// <summary>Draws laid-out blocks at an offset; editable fields become controls when <paramref name="interactive"/>.</summary>
        void DrawLayout(LayoutResult lr, Vector2 offset, bool interactive)
        {
            if (Event.current.type == EventType.Repaint)
            {
                foreach (var bb in lr.Blocks) DrawBlockBody(bb, offset);
                // Tabs under statement blocks go over the next block's top, so stacks look joined.
                foreach (var bb in lr.Blocks)
                {
                    if (!bb.Shape.Next) continue;
                    var b = bb.Box;
                    Fill(new Rect(b.X + offset.x + 12, b.Bottom + offset.y - 1, 16, 4), ColourOf(bb.Shape.Colour), 1);
                }
                foreach (var s in lr.Slots) Fill(ToRect(s.Box, offset), new Color(0, 0, 0, 0.35f), 6);
                foreach (var bb in lr.Blocks)
                {
                    if (bb.Block.IsShadow) continue;
                    if (interactive && bb.Block.Id == selectedId) Outline(ToRect(bb.Box, offset), SelectColour, 2, 4);
                    else if (interactive && warned.Contains(bb.Block.Id)) Outline(ToRect(bb.Box, offset), WarnColour, 2, 4);
                }
            }
            foreach (var f in lr.Fields) DrawField(f, offset, interactive);
        }

        void DrawBlockBody(BlockBox bb, Vector2 offset)
        {
            var c = ColourOf(bb.Shape.Colour);
            if (bb.Block.IsShadow) c = Color.Lerp(c, Color.white, 0.25f);
            var dark = Color.Lerp(c, Color.black, 0.3f);
            var radius = bb.Shape.Output ? 8f : 3f;
            for (var i = 0; i < bb.Body.Count; i++)
            {
                var r = ToRect(bb.Body[i], offset);
                // Pieces of one block touch; a 1px overlap hides the seams.
                if (i > 0) r.yMin -= 1;
                Fill(r, c, bb.Body.Count == 1 ? radius : 2);
            }
            if (bb.Shape.IsEvent && bb.Body.Count > 0)
            {
                var top = ToRect(bb.Body[0], offset);
                Fill(new Rect(top.x, top.y, top.width, BlockLayout.HatHeight), Color.Lerp(c, Color.white, 0.2f), 6);
            }
            if (bb.Shape.Output && !bb.Block.IsShadow)
            {
                var b = bb.Box;
                Fill(new Rect(b.X + offset.x - 3, b.Y + offset.y + 5, 4, Math.Min(12, b.H - 10)), dark, 1);
            }
            if (bb.Shape.Previous && bb.Block.Parent == null)
            {
                var b = bb.Box;
                Fill(new Rect(b.X + offset.x + 12, b.Y + offset.y, 16, 3), dark, 1);
            }
            if (bb.Shape.Unknown) Outline(ToRect(bb.Box, offset), Color.red, 1, 3);
        }

        void DrawField(FieldBox f, Vector2 offset, bool interactive)
        {
            var r = ToRect(f.Box, offset);
            var field = f.Field;
            if (!field.Editable || !interactive)
            {
                if (Event.current.type != EventType.Repaint) return;
                if (field.Editable)
                {
                    if (field.Kind == "dropdown")
                    {
                        Fill(r, new Color(0, 0, 0, 0.25f), 4);
                        GUI.Label(new Rect(r.x + 5, r.y, r.width - 5, r.height), f.Text + " ▾", blockLabel);
                    }
                    else if (field.Kind == "checkbox")
                    {
                        Fill(r, Color.white, 3);
                        if (f.Text == "TRUE") GUI.Label(r, "✓", fieldText);
                    }
                    else
                    {
                        Fill(r, Color.white, 4);
                        var dark = new GUIStyle(blockLabel) { alignment = TextAnchor.MiddleCenter };
                        dark.normal.textColor = new Color(0.1f, 0.1f, 0.1f);
                        GUI.Label(r, f.Text, dark);
                    }
                }
                else
                {
                    GUI.Label(r, f.Text, blockLabel);
                }
                return;
            }
            var b = f.Block;
            switch (field.Kind)
            {
                case "text":
                {
                    var value = EditorGUI.DelayedTextField(r, f.Text, fieldText);
                    if (value != f.Text) SetField(b, field, value);
                    break;
                }
                case "number":
                {
                    var text = EditorGUI.DelayedTextField(r, f.Text, fieldText);
                    if (text != f.Text)
                    {
                        double d;
                        if (double.TryParse(text.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out d)) SetField(b, field, ClampNumber(field, d));
                    }
                    break;
                }
                case "dropdown":
                {
                    var labels = new string[field.Options.Count];
                    var current = b.Fields.Has(field.Name) ? b.Fields[field.Name] as string : field.Value as string;
                    var index = 0;
                    for (var i = 0; i < labels.Length; i++)
                    {
                        labels[i] = field.Options[i][0];
                        if (field.Options[i][1] == current) index = i;
                    }
                    var chosen = EditorGUI.Popup(r, index, labels, fieldPopup);
                    if (chosen != index && chosen >= 0 && chosen < labels.Length) SetField(b, field, field.Options[chosen][1]);
                    break;
                }
                case "checkbox":
                {
                    var on = f.Text == "TRUE";
                    var now = EditorGUI.Toggle(r, on);
                    if (now != on) SetField(b, field, now ? "TRUE" : "FALSE");
                    break;
                }
            }
        }

        /// <summary>Like Blockly's number field: inside min / max, rounded to the precision.</summary>
        static double ClampNumber(FieldShape f, double d)
        {
            if (f.Precision.HasValue && f.Precision.Value > 0)
            {
                d = Math.Round(d / f.Precision.Value) * f.Precision.Value;
                var digits = f.Precision.Value.ToString("R", CultureInfo.InvariantCulture);
                var dot = digits.IndexOf('.');
                if (dot >= 0) d = Math.Round(d, Math.Min(15, digits.Length - dot - 1));
            }
            if (f.Min.HasValue) d = Math.Max(f.Min.Value, d);
            if (f.Max.HasValue) d = Math.Min(f.Max.Value, d);
            return d;
        }

        // ── OnGUI ───────────────────────────────────────────────────────

        void OnGUI()
        {
            InitStyles();
            var e = Event.current;
            windowMouse = e.mousePosition;
            var resultW = position.width < 1000 ? 280 : ResultWidth;
            paletteRect = new Rect(0, ToolbarHeight, PaletteWidth, position.height - ToolbarHeight);
            resultRect = new Rect(position.width - resultW, ToolbarHeight, resultW, position.height - ToolbarHeight);
            canvasRect = new Rect(PaletteWidth, ToolbarHeight, position.width - PaletteWidth - resultW, position.height - ToolbarHeight);

            DrawToolbar();
            if (!EnsureCore())
            {
                GUILayout.BeginArea(new Rect(10, ToolbarHeight + 10, position.width - 20, position.height - ToolbarHeight - 20));
                EditorGUILayout.HelpBox(problem, MessageType.Error);
                if (GUILayout.Button("読み込み直す", GUILayout.Width(120)))
                {
                    problem = "";
                    loadFailed = false;
                    DisposeCore();
                }
                GUILayout.EndArea();
                return;
            }
            Workspace();
            HandleDrag(e);
            // A cancelled drag reads the workspace back from the state.
            Workspace();
            canvasLayout = layout.Layout(ws.Tops);
            DrawCanvas(e);
            DrawPalette(e);
            DrawResults();
            DrawDragged();
            HandleKeys(e);
        }

        void DrawToolbar()
        {
            GUILayout.BeginArea(new Rect(0, 0, position.width, ToolbarHeight));
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            if (GUILayout.Button("新規", EditorStyles.toolbarButton, GUILayout.Width(44))) New();
            if (GUILayout.Button(new GUIContent("開く...", "保存したブロック（.json）を開きます。Web 版で保存したファイルも開けます"), EditorStyles.toolbarButton, GUILayout.Width(52)))
            {
                PickAndLoad();
                GUIUtility.ExitGUI();
            }
            if (GUILayout.Button(new GUIContent("保存", "ブロックを .json に保存します（Web 版でも開けます）"), EditorStyles.toolbarButton, GUILayout.Width(44)))
            {
                Save(false);
                GUIUtility.ExitGUI();
            }
            if (GUILayout.Button("名前を付けて保存...", EditorStyles.toolbarButton, GUILayout.Width(110)))
            {
                Save(true);
                GUIUtility.ExitGUI();
            }
            GUILayout.Space(8);
            using (new EditorGUI.DisabledScope(ws == null || ws.Tops.Count == 0))
            {
                if (GUILayout.Button(new GUIContent("整列", "ブロックのかたまりを左上から縦に並べます"), EditorStyles.toolbarButton, GUILayout.Width(44))) CleanUp();
                if (GUILayout.Button(new GUIContent("全体を表示", "ブロックが見える位置に移動します"), EditorStyles.toolbarButton, GUILayout.Width(72))) FitView();
            }
            GUILayout.FlexibleSpace();
            GUILayout.Label(FileName + (HasUnsavedChanges() ? " *" : ""), EditorStyles.miniLabel);
            EditorGUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        void DrawCanvas(Event e)
        {
            GUI.BeginGroup(canvasRect);
            var local = new Rect(0, 0, canvasRect.width, canvasRect.height);
            if (e.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(local, CanvasColour);
                const float grid = 24;
                for (var x = Mathf.Repeat(pan.x, grid); x < local.width; x += grid) EditorGUI.DrawRect(new Rect(x, 0, 1, local.height), GridColour);
                for (var y = Mathf.Repeat(pan.y, grid); y < local.height; y += grid) EditorGUI.DrawRect(new Rect(0, y, local.width, 1), GridColour);
            }
            if (ws.Tops.Count == 0 && dragging == null && e.type == EventType.Repaint)
            {
                var hint = new GUIStyle(EditorStyles.centeredGreyMiniLabel) { fontSize = 12, wordWrap = true };
                GUI.Label(new Rect(20, local.height / 2 - 40, local.width - 40, 80),
                    "左のパレットからブロックをドラッグして、ここに置きます。\nまず「イベント」の「開始時」などを置いて、その中に動作のブロックをつなげます。", hint);
            }
            DrawLayout(canvasLayout, pan, dragging == null);

            if (dragging != null && target != null && e.type == EventType.Repaint) DrawTarget(target);

            // Presses the field controls did not take.
            if (e.type == EventType.MouseDown && local.Contains(e.mousePosition) && dragging == null)
            {
                var p = e.mousePosition - pan;
                var hit = canvasLayout.HitBlock(p.x, p.y);
                var block = hit == null ? null : hit.Block;
                while (block != null && block.IsShadow) block = block.Parent;
                if (e.button == 0 && block != null)
                {
                    var box = canvasLayout.ByNode[block].Box;
                    pending = block;
                    pendingAt = windowMouse;
                    grabOffset = new Vector2(box.X + pan.x + canvasRect.x, box.Y + pan.y + canvasRect.y) - windowMouse;
                    selectedId = block.Id;
                    GUI.FocusControl(null);
                    GUIUtility.keyboardControl = 0;
                    e.Use();
                }
                else if (e.button == 1 && block != null)
                {
                    selectedId = block.Id;
                    ContextMenu(block);
                    e.Use();
                }
                else if (e.button == 0 || e.button == 2)
                {
                    selectedId = "";
                    GUI.FocusControl(null);
                    panning = true;
                    e.Use();
                }
            }
            if (e.type == EventType.ScrollWheel && local.Contains(e.mousePosition))
            {
                pan -= (e.shift ? new Vector2(e.delta.y, 0) : e.delta) * 12;
                e.Use();
            }
            GUI.EndGroup();
        }

        void DrawTarget(Connection c)
        {
            var p = new Vector2(c.X, c.Y) + pan;
            switch (c.Kind)
            {
                case ConnectionKind.Value:
                {
                    var size = c.Occupant != null ? layout.SizeOf(c.Occupant) : new Box(0, 0, BlockLayout.EmptySlotWidth, BlockLayout.FieldHeight);
                    var shown = c.Occupant ?? ShownIn(c);
                    if (shown != null) size = layout.SizeOf(shown);
                    Outline(new Rect(p.x - 2, p.y - 2, size.W + 4, size.H + 4), TargetColour, 2, 6);
                    break;
                }
                default:
                    Fill(new Rect(p.x, p.y - 2, 70, 4), TargetColour, 2);
                    break;
            }
        }

        static BlockNode ShownIn(Connection c)
        {
            var slot = c.Owner.Slot(c.Input);
            return slot == null ? null : slot.Shown;
        }

        void ContextMenu(BlockNode b)
        {
            var menu = new GenericMenu();
            menu.AddItem(new GUIContent("複製"), false, () => Duplicate(b));
            menu.AddSeparator("");
            menu.AddItem(new GUIContent("削除（下のブロックはつなげたまま）"), false, () => DeleteBlock(b, false));
            menu.AddItem(new GUIContent("ここから下をまとめて削除"), false, () => DeleteBlock(b, true));
            var shape = catalog.Get(b.Type);
            if (shape.Tooltip != "")
            {
                menu.AddSeparator("");
                menu.AddDisabledItem(new GUIContent(shape.Tooltip.Replace("/", "／")));
            }
            menu.ShowAsContext();
        }

        void HandleKeys(Event e)
        {
            if ((e.type == EventType.ValidateCommand || e.type == EventType.ExecuteCommand) && GUIUtility.keyboardControl == 0)
            {
                var b = Selected();
                if (b == null) return;
                var name = e.commandName;
                if (name == "Delete" || name == "SoftDelete" || name == "Duplicate")
                {
                    if (e.type == EventType.ExecuteCommand)
                    {
                        if (name == "Duplicate") Duplicate(b);
                        else DeleteBlock(b, false);
                    }
                    e.Use();
                }
            }
            else if (e.type == EventType.KeyDown && GUIUtility.keyboardControl == 0 && (e.keyCode == KeyCode.Delete || e.keyCode == KeyCode.Backspace))
            {
                var b = Selected();
                if (b != null)
                {
                    DeleteBlock(b, false);
                    e.Use();
                }
            }
        }

        // ── Dragging ────────────────────────────────────────────────────

        void HandleDrag(Event e)
        {
            if (pending == null && dragging == null && !panning) return;
            if (e.type == EventType.KeyDown && e.keyCode == KeyCode.Escape)
            {
                CancelDrag();
                e.Use();
                return;
            }
            if (e.type == EventType.MouseDrag)
            {
                if (panning)
                {
                    pan += e.delta;
                }
                else if (pending != null && (windowMouse - pendingAt).magnitude > DragThreshold)
                {
                    ws.Detach(pending);
                    dragging = pending;
                    dragFromPalette = false;
                    pending = null;
                }
                if (dragging != null) UpdateTarget();
                e.Use();
                Repaint();
            }
            else if (e.rawType == EventType.MouseUp)
            {
                if (dragging != null) Drop();
                pending = null;
                panning = false;
                e.Use();
                Repaint();
            }
        }

        /// <summary>Where the dragged chain's top-left is on the canvas.</summary>
        Vector2 DropPoint()
        {
            return windowMouse + grabOffset - canvasRect.position - pan;
        }

        void UpdateTarget()
        {
            target = null;
            if (!canvasRect.Contains(windowMouse)) return;
            var p = DropPoint();
            var chain = layout.SizeOfChain(dragging);
            target = canvasLayout.FindTarget(catalog.Get(dragging.Type), catalog.Get(dragging.Last.Type), p.x, p.y, chain.H, catalog, SnapRadius);
        }

        void Drop()
        {
            UpdateTarget();
            var b = dragging;
            var fromPalette = dragFromPalette;
            var p = DropPoint();
            var t = target;
            dragging = null;
            target = null;
            if (paletteRect.Contains(windowMouse))
            {
                // Dropped back on the palette: deleted (from the palette: nothing happens).
                if (!fromPalette) Commit("削除");
                selectedId = "";
                return;
            }
            if (!canvasRect.Contains(windowMouse))
            {
                if (!fromPalette) ws = null; // back where it was
                return;
            }
            var bump = new Vector2(p.x + 30, p.y + 30);
            if (t == null) ws.AddTop(b, Snap(p.x), Snap(p.y));
            else
            {
                switch (t.Kind)
                {
                    case ConnectionKind.Value:
                        ws.ConnectValue(t.Owner, t.Input, b, bump.x, bump.y);
                        break;
                    case ConnectionKind.Next:
                        ws.ConnectStatement(t.Owner, null, b, catalog, bump.x, bump.y);
                        break;
                    case ConnectionKind.Statement:
                        ws.ConnectStatement(t.Owner, t.Input, b, catalog, bump.x, bump.y);
                        break;
                    case ConnectionKind.Above:
                        ws.ConnectAbove(t.Owner, b, t.Owner.X, t.Owner.Y - layout.SizeOfChain(b).H);
                        break;
                }
            }
            selectedId = b.Id;
            Commit(fromPalette ? "追加" : "移動");
        }

        static double Snap(float v)
        {
            return Math.Round(v);
        }

        void CancelDrag()
        {
            if (dragging != null && !dragFromPalette) ws = null; // read back from the state: the block returns
            dragging = null;
            pending = null;
            panning = false;
            target = null;
        }

        void DrawDragged()
        {
            if (dragging == null) return;
            var at = windowMouse + grabOffset;
            var lr = layout.LayoutAt(dragging, 0, 0);
            var shadow = new Rect(at.x + 4, at.y + 4, lr.Bounds.W, lr.Bounds.H);
            if (Event.current.type == EventType.Repaint) Fill(shadow, new Color(0, 0, 0, 0.3f), 4);
            DrawLayout(lr, at, false);
            if (paletteRect.Contains(windowMouse) && Event.current.type == EventType.Repaint && !dragFromPalette)
            {
                GUI.Label(new Rect(at.x, at.y - 18, 200, 16), "ここで離すと削除", EditorStyles.whiteBoldLabel);
            }
        }

        // ── Palette ─────────────────────────────────────────────────────

        void DrawPalette(Event e)
        {
            GUILayout.BeginArea(paletteRect, EditorStyles.helpBox);
            var names = new GUIContent[catalog.Categories.Count];
            for (var i = 0; i < names.Length; i++) names[i] = new GUIContent(catalog.Categories[i].Name);
            category = Mathf.Clamp(category, 0, Math.Max(0, names.Length - 1));
            for (var i = 0; i < names.Length; i++)
            {
                var r = GUILayoutUtility.GetRect(names[i], EditorStyles.miniButton, GUILayout.Height(18));
                var c = ColourOf(catalog.Categories[i].Colour);
                if (e.type == EventType.Repaint) EditorGUI.DrawRect(new Rect(r.x, r.y + 2, 6, r.height - 4), c);
                var label = new Rect(r.x + 10, r.y, r.width - 10, r.height);
                if (GUI.Toggle(label, category == i, names[i], EditorStyles.miniButton) && category != i)
                {
                    category = i;
                    paletteScroll = Vector2.zero;
                }
            }
            GUILayout.Space(4);
            paletteScroll = GUILayout.BeginScrollView(paletteScroll);
            paletteHits.Clear();
            if (names.Length > 0)
            {
                foreach (var item in catalog.Categories[category].Items) DrawPaletteItem(item);
            }
            // A press on a palette block starts dragging a new copy of it.
            if (e.type == EventType.MouseDown && e.button == 0 && dragging == null)
            {
                foreach (var hit in paletteHits)
                {
                    if (!hit.Value.Contains(e.mousePosition)) continue;
                    var lr = layout.LayoutAt(paletteBlocks[hit.Key], hit.Value.x, hit.Value.y);
                    if (lr.HitBlock(e.mousePosition.x, e.mousePosition.y) == null) continue;
                    dragging = ws.FromTemplate(hit.Key.Template);
                    dragFromPalette = true;
                    grabOffset = new Vector2(hit.Value.x, hit.Value.y) - e.mousePosition;
                    target = null;
                    GUI.FocusControl(null);
                    e.Use();
                    break;
                }
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        void DrawPaletteItem(PaletteItem item)
        {
            switch (item.Kind)
            {
                case "label":
                    GUILayout.Label(item.Text, EditorStyles.miniBoldLabel);
                    break;
                case "button":
                    if (item.CallbackKey == PartsCallback) DrawParts();
                    break;
                case "block":
                {
                    BlockNode node;
                    if (!paletteBlocks.TryGetValue(item, out node))
                    {
                        node = new BlockWorkspace().FromTemplate(item.Template);
                        paletteBlocks[item] = node;
                    }
                    var lr = layout.LayoutAt(node, 0, 0);
                    var r = GUILayoutUtility.GetRect(lr.Bounds.W + 12, lr.Bounds.H + 10);
                    var at = new Vector2(r.x + 6, r.y + 4);
                    DrawLayout(lr, at, false);
                    var shape = catalog.Get(item.Type);
                    if (shape.Tooltip != "") GUI.Label(new Rect(at.x, at.y, lr.Bounds.W, lr.Bounds.H), new GUIContent("", shape.Tooltip));
                    paletteHits.Add(new KeyValuePair<PaletteItem, Rect>(item, new Rect(at.x, at.y, lr.Bounds.W, lr.Bounds.H)));
                    break;
                }
            }
        }

        /// <summary>Parts (部品): a finished set of blocks added with chosen values, like the Web editor's parts tab.</summary>
        void DrawParts()
        {
            if (parts == null || parts.Count == 0)
            {
                EditorGUILayout.HelpBox("部品を読み込めませんでした。", MessageType.Warning);
                return;
            }
            foreach (var part in parts)
            {
                EditorGUILayout.BeginVertical(EditorStyles.helpBox);
                GUILayout.Label(part.Label, EditorStyles.boldLabel);
                GUILayout.Label(part.Description, smallWrap);
                Dictionary<string, string> values;
                if (!partValues.TryGetValue(part.Id, out values))
                {
                    values = new Dictionary<string, string>();
                    foreach (var p in part.Params) values[p.Key] = p.Default;
                    partValues[part.Id] = values;
                }
                foreach (var p in part.Params)
                {
                    if (p.Kind == "axis")
                    {
                        var index = Math.Max(0, Array.IndexOf(Axes, values[p.Key]));
                        values[p.Key] = Axes[EditorGUILayout.Popup(p.Label, index, Axes)];
                    }
                    else
                    {
                        double d;
                        double.TryParse(values[p.Key], NumberStyles.Float, CultureInfo.InvariantCulture, out d);
                        var now = EditorGUILayout.DoubleField(p.Label, d);
                        now = Math.Max(p.Min, Math.Min(p.Max, now));
                        values[p.Key] = now.ToString("R", CultureInfo.InvariantCulture);
                    }
                }
                if (GUILayout.Button("ブロックとして追加")) AddPart(part, values);
                EditorGUILayout.EndVertical();
            }
        }

        void AddPart(CoreHost.PartInfo part, Dictionary<string, string> values)
        {
            var o = new JsonObject();
            foreach (var p in part.Params)
            {
                if (p.Kind == "axis") o[p.Key] = values[p.Key];
                else o[p.Key] = double.Parse(values[p.Key], CultureInfo.InvariantCulture);
            }
            var r = core.AddPart(state.Json == "" ? "{}" : state.Json, part.Id, Json.Write(o));
            if (!r.Ok)
            {
                EditorUtility.DisplayDialog("Jcreate++", "部品を追加できませんでした: " + r.Error, "OK");
                if (core.IsStopped) EnsureCore();
                return;
            }
            try
            {
                ws = BlockWorkspace.FromJson(r.Json);
            }
            catch (FormatException ex)
            {
                EditorUtility.DisplayDialog("Jcreate++", "部品を追加できませんでした: " + ex.Message, "OK");
                return;
            }
            LoadMissingShapes(ws);
            Commit("部品「" + part.Label + "」を追加");
            notice = "部品「" + part.Label + "」を追加しました（元に戻す: Ctrl+Z）。";
        }

        // ── Results ─────────────────────────────────────────────────────

        void DrawResults()
        {
            GUILayout.BeginArea(resultRect, EditorStyles.helpBox);
            resultScroll = EditorGUILayout.BeginScrollView(resultScroll);
            if (problem != "") EditorGUILayout.HelpBox(problem, MessageType.Error);
            if (notice != "") EditorGUILayout.HelpBox(notice, MessageType.None);

            EditorGUILayout.LabelField("変換の結果", EditorStyles.boldLabel);
            if (result == null || convertPending)
            {
                EditorGUILayout.LabelField("変換しています…", EditorStyles.miniLabel);
            }
            else if (!result.Ok)
            {
                EditorGUILayout.HelpBox(result.Error, MessageType.Error);
            }
            else
            {
                if (result.Errors.Count > 0)
                {
                    EditorGUILayout.LabelField("変換できないところ", EditorStyles.miniBoldLabel);
                    foreach (var err in result.Errors) EditorGUILayout.HelpBox(err, MessageType.Error);
                }
                foreach (var w in result.Warnings)
                {
                    EditorGUILayout.BeginHorizontal();
                    EditorGUILayout.HelpBox(w.Text, MessageType.Warning);
                    if (w.BlockId != "" && GUILayout.Button(new GUIContent("見る", "このブロックを選んで表示します"), GUILayout.Width(40), GUILayout.Height(38))) Reveal(w.BlockId);
                    EditorGUILayout.EndHorizontal();
                }
                if (result.Code == "" && result.Errors.Count == 0) EditorGUILayout.HelpBox("まだコードになるブロックがありません。イベントのブロック（開始時 など）を置いて、中に動作をつなげてください。", MessageType.Info);
                if (result.SizeText != "") EditorGUILayout.LabelField("大きさ: " + result.SizeText, EditorStyles.miniLabel);
                if (result.OverCraftItemLimit) EditorGUILayout.HelpBox("クラフトアイテムの上限を超えています（ワールドに置くアイテムなら使えます）。", MessageType.Warning);
            }

            EditorGUILayout.Space();
            var hasCode = result != null && result.Ok && result.Code != "" && !convertPending;
            using (new EditorGUI.DisabledScope(!hasCode))
            {
                if (GUILayout.Button(new GUIContent(" プレビューで動かす", EditorGUIUtility.IconContent("PlayButton").image, "ウィンドウの中の立方体で動かします（シーンには触れません）"), GUILayout.Height(26)))
                {
                    PreviewWindow.ShowCode(result.Code, state.AssetPath != "" ? Path.GetFileNameWithoutExtension(state.AssetPath) : "未保存");
                }
            }
            var auto = EditorGUILayout.ToggleLeft("ブロックを変えたら、開いているプレビューもやり直す", autoPreview, EditorStyles.miniLabel);
            if (auto != autoPreview)
            {
                autoPreview = auto;
                SyncPreview();
            }

            EditorGUILayout.Space();
            var go = Selection.activeGameObject;
            var canApply = hasCode && go != null && !EditorUtility.IsPersistent(go);
            using (new EditorGUI.DisabledScope(!canApply))
            {
                var label = go != null && !EditorUtility.IsPersistent(go) ? "「" + go.name + "」に設定する" : "選択中のオブジェクトに設定する";
                if (GUILayout.Button(new GUIContent(label, "コードを .js に書き出して、Item / Scriptable Item などを付けます（Ctrl+Z で戻せます）"), GUILayout.Height(26)))
                {
                    ApplyToSelection();
                    GUIUtility.ExitGUI();
                }
            }
            if (go == null || EditorUtility.IsPersistent(go)) EditorGUILayout.LabelField("ヒエラルキーでオブジェクトを選ぶと設定できます。", EditorStyles.miniLabel);
            using (new EditorGUI.DisabledScope(!hasCode))
            {
                if (GUILayout.Button(new GUIContent(".js を書き出す", "保存したブロックと同じ名前の .js に、コードを書き出します"), EditorStyles.miniButton))
                {
                    var asset = WriteScript();
                    if (asset != null) notice = "書き出しました: " + AssetDatabase.GetAssetPath(asset);
                    GUIUtility.ExitGUI();
                }
            }

            if (applyResult != null)
            {
                EditorGUILayout.Space();
                EditorGUILayout.LabelField("設定したこと" + (applyTarget != null ? "（" + applyTarget.name + "）" : ""), EditorStyles.boldLabel);
                foreach (var line in applyResult.Done) EditorGUILayout.LabelField("・" + line, EditorStyles.wordWrappedMiniLabel);
                foreach (var line in applyResult.Warnings) EditorGUILayout.HelpBox(line, MessageType.Warning);
                if (applyTarget != null && hasCode)
                {
                    foreach (var check in SetupChecks.Run(applyTarget, ScriptAnalysis.Analyze(result.Code)))
                    {
                        EditorGUILayout.HelpBox(check.Text, check.Ok ? MessageType.None : MessageType.Warning);
                    }
                }
            }

            if (hasCode && result.SetupJson != "")
            {
                EditorGUILayout.Space();
                showSetup = EditorGUILayout.Foldout(showSetup, "アイテムに必要なもの", true);
                if (showSetup) DrawSetup(result.SetupJson);
            }

            if (hasCode)
            {
                EditorGUILayout.Space();
                showCode = EditorGUILayout.Foldout(showCode, "できたコード（Cluster Script）", true);
                if (showCode)
                {
                    var style = new GUIStyle(EditorStyles.textArea) { wordWrap = false, fontSize = 11 };
                    var size = style.CalcSize(new GUIContent(result.Code));
                    EditorGUILayout.SelectableLabel(result.Code, style, GUILayout.Height(size.y + 4), GUILayout.MinWidth(size.x));
                }
            }
            EditorGUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        void DrawSetup(string setupJson)
        {
            var o = Json.TryParse(setupJson) as JsonObject;
            if (o == null) return;
            var components = o.Array("components");
            if (components != null && components.Count > 0)
            {
                var names = new List<string>();
                foreach (var c in components) names.Add(c as string ?? "");
                EditorGUILayout.LabelField("コンポーネント: " + string.Join(" / ", names.ToArray()), EditorStyles.wordWrappedMiniLabel);
            }
            Lines(o.Array("problems"), MessageType.Error);
            Lines(o.Array("checks"), MessageType.Info);
            var blockers = o.Array("craftItemBlockers");
            if (blockers != null && blockers.Count > 0)
            {
                EditorGUILayout.LabelField("クラフトアイテムにできない理由", EditorStyles.miniBoldLabel);
                Lines(blockers, MessageType.None);
            }
        }

        static void Lines(List<object> lines, MessageType type)
        {
            if (lines == null) return;
            foreach (var line in lines)
            {
                var s = line as string;
                if (!string.IsNullOrEmpty(s)) EditorGUILayout.HelpBox(s, type);
            }
        }
    }
}
