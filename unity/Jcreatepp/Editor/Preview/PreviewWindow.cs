using System;
using System.Collections.Generic;
using System.Diagnostics;
using ClusterVR.CreatorKit.Item.Implements;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor.Preview
{
    /// <summary>
    /// メニュー「Jcreate++ > プレビュー」。Jcreate++ のスクリプト（.js）を、ウィンドウの中の立方体で動かして見る。
    /// シーンのオブジェクトにも Play モードにも触れない。動きの計算は Web版の 3D プレビューと同じシミュレーター。
    /// </summary>
    public sealed class PreviewWindow : EditorWindow
    {
        const double FrameSeconds = 1.0 / 60.0;
        /// <summary>Most simulation frames per editor update; time beyond that is dropped (no catching up).</summary>
        const int MaxFramesPerUpdate = 10;
        const long MaxMillisecondsPerUpdate = 50;
        const int LogShown = 50;

        static readonly string[] SpeedLabels = { "×0.25", "×0.5", "×1", "×2", "×4" };
        static readonly float[] Speeds = { 0.25f, 0.5f, 1f, 2f, 4f };

        static readonly Dictionary<string, string> EventLabels = new Dictionary<string, string>
        {
            { "interact", "インタラクト時" },
            { "grab", "持ったとき" },
            { "release", "離したとき" },
            { "collide", "衝突したとき" },
        };

        static readonly Dictionary<string, string> EventTips = new Dictionary<string, string>
        {
            { "interact", "クリック（使う）されたときの処理を動かします（$.onInteract）" },
            { "grab", "持たれた瞬間の処理を動かします（$.onGrab, isGrab = true）" },
            { "release", "離された瞬間の処理を動かします（$.onGrab, isGrab = false）" },
            { "collide", "何かにぶつかったときの処理を動かします（$.onCollide）。相手は仮のアイテムです" },
        };

        [SerializeField] JavaScriptAsset script;
        [SerializeField] int speedIndex = 2;
        [SerializeField] bool showTransform = true;
        [SerializeField] bool showState = true;
        [SerializeField] bool showLog = true;
        [SerializeField] bool showHelp;
        [SerializeField] string receiveName = "open";
        [SerializeField] string receiveValue = "";

        string simulatorBundle;
        SimHost host;
        PreviewStage stage;
        SimHost.Snapshot snapshot;
        readonly List<SimHost.LogLine> log = new List<SimHost.LogLine>();
        string notice = "";
        string problem = "";
        bool playing;
        double accumulated;
        double lastUpdate;
        Vector2 scroll;

        [MenuItem("Jcreate++/プレビュー", false, 10)]
        public static void Open()
        {
            var window = GetWindow<PreviewWindow>();
            window.titleContent = new GUIContent("Jcreate++ プレビュー");
            window.minSize = new Vector2(340, 480);
            window.Show();
        }

        void OnEnable()
        {
            stage = new PreviewStage();
            EditorApplication.update += Tick;
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
            AssemblyReloadEvents.beforeAssemblyReload += Shutdown;
            if (script != null) Restart();
        }

        void OnDisable()
        {
            Shutdown();
            if (stage != null)
            {
                stage.Dispose();
                stage = null;
            }
        }

        /// <summary>Stops playing and releases the script engine (closing, recompiling, entering Play mode).</summary>
        void Shutdown()
        {
            EditorApplication.update -= Tick;
            EditorApplication.playModeStateChanged -= OnPlayModeChanged;
            AssemblyReloadEvents.beforeAssemblyReload -= Shutdown;
            playing = false;
            if (host != null)
            {
                host.Dispose();
                host = null;
            }
        }

        /// <summary>Another tab was brought to front: the preview pauses (it does not run while not shown).</summary>
        void OnBecameInvisible()
        {
            SetPlaying(false);
        }

        void OnPlayModeChanged(PlayModeStateChange change)
        {
            if (change == PlayModeStateChange.ExitingEditMode) SetPlaying(false);
        }

        void SetPlaying(bool value)
        {
            playing = value;
            accumulated = 0;
            lastUpdate = EditorApplication.timeSinceStartup;
        }

        /// <summary>The simulator bundle shipped with this extension (Sim/jcreatepp-sim.txt).</summary>
        string LoadBundle()
        {
            if (simulatorBundle != null) return simulatorBundle;
            foreach (var guid in AssetDatabase.FindAssets("jcreatepp-sim t:TextAsset"))
            {
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (asset != null) return simulatorBundle = asset.text;
            }
            return null;
        }

        /// <summary>「最初から」: a new engine, the script loaded again, its 開始時 run once.</summary>
        void Restart()
        {
            SetPlaying(false);
            if (host != null) host.Dispose();
            host = null;
            snapshot = null;
            log.Clear();
            notice = "";
            problem = "";
            if (script == null) return;

            var bundle = LoadBundle();
            if (bundle == null)
            {
                problem = "シミュレーター（jcreatepp-sim.txt）が見つかりません。Jcreatepp フォルダを丸ごと入れ直してください。";
                return;
            }
            try
            {
                host = new SimHost(bundle);
            }
            catch (Exception e)
            {
                problem = "プレビューを始められませんでした: " + e.GetType().Name + ": " + e.Message;
                return;
            }
            // The item starts at the origin, like the Web preview (the scene is not used).
            var error = host.Load(script.text, new double[] { 0, 0, 0 }, new double[] { 0, 0, 0, 1 });
            if (error != "")
            {
                problem = error;
                return;
            }
            notice = "開始時の処理を実行しました。▶ 再生 で毎フレームの処理が動きます。";
            Refresh();
        }

        void Tick()
        {
            if (!playing || host == null) return;
            var now = EditorApplication.timeSinceStartup;
            accumulated += Math.Min(0.25, now - lastUpdate) * Speeds[speedIndex];
            lastUpdate = now;
            var watch = Stopwatch.StartNew();
            var frames = 0;
            while (accumulated >= FrameSeconds && frames < MaxFramesPerUpdate && watch.ElapsedMilliseconds < MaxMillisecondsPerUpdate)
            {
                host.Step(FrameSeconds);
                accumulated -= FrameSeconds;
                frames++;
                if (host.IsStopped) break;
            }
            if (accumulated >= FrameSeconds) accumulated = 0; // too slow to keep up: drop the rest
            if (frames > 0) Refresh();
        }

        void Fire(string name, string message, string value)
        {
            if (host == null) return;
            host.Fire(name, message, value);
            Refresh();
        }

        /// <summary>Reads the simulator state after any change and redraws.</summary>
        void Refresh()
        {
            if (host == null) return;
            var next = host.TakeSnapshot();
            if (host.IsStopped)
            {
                SetPlaying(false);
                problem = host.StopReason;
            }
            if (next != null)
            {
                snapshot = next;
                log.AddRange(next.Log);
                if (log.Count > LogShown) log.RemoveRange(0, log.Count - LogShown);
            }
            Repaint();
        }

        void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);

            // ① スクリプト
            EditorGUILayout.LabelField("① スクリプトを選ぶ", EditorStyles.boldLabel);
            EditorGUI.BeginChangeCheck();
            script = (JavaScriptAsset)EditorGUILayout.ObjectField(
                new GUIContent("スクリプト", "Jcreate++ の「JS保存」で保存した .js（JavaScript Asset）"), script, typeof(JavaScriptAsset), false);
            if (EditorGUI.EndChangeCheck()) Restart();
            if (script == null)
            {
                EditorGUILayout.HelpBox("Jcreate++ の「JS保存」で保存した .js をプロジェクトに入れて、ここに入れてください。", MessageType.Info);
                Footer();
                EditorGUILayout.EndScrollView();
                return;
            }

            // ② 再生
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("② 再生する", EditorStyles.boldLabel);
            Toolbar();
            var rect = GUILayoutUtility.GetRect(200f, 10000f, 220f, 320f);
            if (stage != null)
            {
                if (stage.HandleInput(rect)) Repaint();
                var position = snapshot != null ? new Vector3((float)snapshot.Position[0], (float)snapshot.Position[1], (float)snapshot.Position[2]) : Vector3.zero;
                var rotation = snapshot != null
                    ? new Quaternion((float)snapshot.Rotation[0], (float)snapshot.Rotation[1], (float)snapshot.Rotation[2], (float)snapshot.Rotation[3])
                    : Quaternion.identity;
                stage.Draw(rect, position, rotation);
            }
            EditorGUILayout.LabelField("ドラッグで回転、ホイールで拡大・縮小。青い線が前（+Z）です。", EditorStyles.miniLabel);
            if (notice != "") EditorGUILayout.HelpBox(notice, MessageType.None);
            if (problem != "") EditorGUILayout.HelpBox(problem, MessageType.Error);
            if (snapshot != null && snapshot.LastError != "") EditorGUILayout.HelpBox("スクリプトでエラーが起きました: " + snapshot.LastError, MessageType.Warning);

            // ③ イベント
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("③ イベントを起こして試す", EditorStyles.boldLabel);
            Events();

            EditorGUILayout.Space();
            TransformSection();
            StateSection();
            LogSection();
            HelpSection();
            Footer();
            EditorGUILayout.EndScrollView();
        }

        void Toolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            using (new EditorGUI.DisabledScope(host == null))
            {
                var playContent = playing
                    ? new GUIContent(" 一時停止", EditorGUIUtility.IconContent("PauseButton").image, "毎フレームの処理を止めます")
                    : new GUIContent(" 再生", EditorGUIUtility.IconContent("PlayButton").image, "毎フレームの処理を動かします（$.onUpdate）");
                if (GUILayout.Button(playContent, EditorStyles.toolbarButton, GUILayout.Width(80))) SetPlaying(!playing);
                if (GUILayout.Button(new GUIContent(" 1コマ", EditorGUIUtility.IconContent("StepButton").image, "1/60 秒だけ進めます"), EditorStyles.toolbarButton, GUILayout.Width(64)))
                {
                    host.Step(FrameSeconds);
                    Refresh();
                }
            }
            if (GUILayout.Button(new GUIContent(" 最初から", EditorGUIUtility.IconContent("Refresh").image, "読み込み直して、開始時の処理からやり直します"), EditorStyles.toolbarButton, GUILayout.Width(80)))
            {
                Restart();
            }
            // In a narrow window the speed and the time go to a second toolbar row.
            if (position.width < 420f)
            {
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
                EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            }
            speedIndex = EditorGUILayout.Popup(speedIndex, SpeedLabels, EditorStyles.toolbarPopup, GUILayout.Width(56));
            GUILayout.FlexibleSpace();
            GUILayout.Label(snapshot != null ? snapshot.Time.ToString("0.00") + " 秒" : "", EditorStyles.miniLabel);
            EditorGUILayout.EndHorizontal();
        }

        void Events()
        {
            if (host == null || snapshot == null)
            {
                EditorGUILayout.HelpBox("スクリプトを読み込むと、ここにイベントのボタンが出ます。", MessageType.None);
                return;
            }
            var buttons = new List<string>();
            foreach (var e in snapshot.Events) if (EventLabels.ContainsKey(e)) buttons.Add(e);
            var receives = snapshot.Events.Contains("receive");
            if (buttons.Count == 0 && !receives)
            {
                EditorGUILayout.HelpBox("このスクリプトには、ボタンで起こせるイベント（インタラクト時など）がありません。▶ 再生 で毎フレームの処理を試せます。", MessageType.Info);
                return;
            }
            // Two buttons per row so long Japanese labels fit in a narrow window.
            for (var i = 0; i < buttons.Count; i += 2)
            {
                EditorGUILayout.BeginHorizontal();
                for (var j = i; j < Math.Min(i + 2, buttons.Count); j++)
                {
                    var name = buttons[j];
                    if (GUILayout.Button(new GUIContent(EventLabels[name], EventTips[name]))) Fire(name, "", "");
                }
                EditorGUILayout.EndHorizontal();
            }
            if (receives)
            {
                EditorGUILayout.LabelField("メッセージを受け取ったとき", EditorStyles.miniBoldLabel);
                receiveName = EditorGUILayout.TextField(new GUIContent("メッセージ名", "送られてくるメッセージの名前（例: open）"), receiveName);
                receiveValue = EditorGUILayout.TextField(new GUIContent("値", "空 = 値なし／true・false = 真偽値／数字 = 数値／それ以外 = 文字"), receiveValue);
                if (GUILayout.Button(new GUIContent("受信する", "このメッセージを受け取ったことにします（$.onReceive）"))) Fire("receive", receiveName, receiveValue);
            }
        }

        void TransformSection()
        {
            showTransform = EditorGUILayout.Foldout(showTransform, "位置と角度", true);
            if (!showTransform || snapshot == null) return;
            EditorGUI.indentLevel++;
            Row(new GUIContent("位置 (m)", "Position。x 右 / y 上 / z 前"), Xyz(snapshot.Position));
            Row(new GUIContent("角度 (度)", "Rotation（オイラー角）。0〜360° で表すので、何周回ったかは表せません"), Xyz(snapshot.Euler));
            EditorGUI.indentLevel--;
        }

        void StateSection()
        {
            showState = EditorGUILayout.Foldout(showState, "変数・フラグ・クールダウン", true);
            if (!showState || snapshot == null) return;
            EditorGUI.indentLevel++;
            if (snapshot.State.Count == 0)
            {
                EditorGUILayout.LabelField("まだ値の入った変数はありません。", EditorStyles.miniLabel);
            }
            else
            {
                var group = "";
                foreach (var row in snapshot.State)
                {
                    if (row.Group != group)
                    {
                        group = row.Group;
                        EditorGUILayout.LabelField(group, EditorStyles.miniBoldLabel);
                    }
                    Row(new GUIContent(row.Name), row.Text);
                }
            }
            EditorGUILayout.LabelField("値が入ったものから表示されます（一度も使われていない変数は出ません）。", EditorStyles.wordWrappedMiniLabel);
            EditorGUI.indentLevel--;
        }

        void LogSection()
        {
            showLog = EditorGUILayout.Foldout(showLog, "ログ（" + log.Count + "）", true);
            if (!showLog) return;
            EditorGUI.indentLevel++;
            if (log.Count == 0) EditorGUILayout.LabelField("まだ何も起きていません。", EditorStyles.miniLabel);
            for (var i = log.Count - 1; i >= 0; i--)
            {
                var line = log[i];
                var text = line.Time.ToString("0.00") + " 秒  " + line.Text;
                if (line.Kind == "error") EditorGUILayout.HelpBox(text, MessageType.Error);
                else EditorGUILayout.LabelField(text, EditorStyles.wordWrappedLabel);
            }
            if (log.Count > 0 && GUILayout.Button("ログを消す", EditorStyles.miniButton, GUILayout.Width(80))) log.Clear();
            EditorGUI.indentLevel--;
        }

        void HelpSection()
        {
            showHelp = EditorGUILayout.Foldout(showHelp, "動かないときは", true);
            if (!showHelp) return;
            EditorGUI.indentLevel++;
            EditorGUILayout.LabelField("・ボタンが出ないイベントは、スクリプトに入っていません（例: 「インタラクト時」のブロックが無い）。", EditorStyles.wordWrappedLabel);
            EditorGUILayout.LabelField("・メッセージは、送る側と同じ名前を「メッセージ名」に入れてください。", EditorStyles.wordWrappedLabel);
            if (snapshot != null && snapshot.Unsupported.Count > 0)
            {
                EditorGUILayout.LabelField("・プレビューで未対応の機能（何もしません）: " + string.Join(", ", snapshot.Unsupported.ToArray()), EditorStyles.wordWrappedLabel);
            }
            EditorGUI.indentLevel--;
        }

        static void Footer()
        {
            EditorGUILayout.Space();
            EditorGUILayout.HelpBox("ここでの動きは目安です。物理・ほかのアイテム・プレイヤー・音・文字の表示は再現しません（音や文字はログに出ます）。最後はワールドにアップロードして確かめてください。", MessageType.Info);
        }

        static void Row(GUIContent label, string value)
        {
            var rect = EditorGUILayout.GetControlRect();
            var valueRect = EditorGUI.PrefixLabel(rect, label);
            EditorGUI.SelectableLabel(valueRect, value);
        }

        static string Xyz(double[] v)
        {
            return v[0].ToString("0.000") + "   " + v[1].ToString("0.000") + "   " + v[2].ToString("0.000");
        }
    }
}
