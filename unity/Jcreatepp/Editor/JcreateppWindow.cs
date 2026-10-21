using System.Collections.Generic;
using System.IO;
using ClusterVR.CreatorKit.Item.Implements;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor
{
    /// <summary>
    /// メニュー「Jcreate++」と、そこから開くウィンドウ。
    /// 1. スクリプト（Jcreate++ で保存した .js）を選ぶ
    /// 2. 設定するオブジェクトを選ぶ（ヒエラルキーで選んだものが入る）
    /// 3. 「このオブジェクトに設定する」で Item / Scriptable Item などを付ける
    /// </summary>
    public sealed class JcreateppWindow : EditorWindow
    {
        /// <summary>Assets の外から選んだ .js をコピーする場所。</summary>
        const string ImportFolder = "Assets/Jcreatepp Scripts";

        JavaScriptAsset script;
        GameObject target;
        ItemSetup.Result lastResult;
        Vector2 scroll;

        [MenuItem("Jcreate++/セットアップ ウィンドウを開く", false, 0)]
        public static void Open()
        {
            var window = GetWindow<JcreateppWindow>("Jcreate++");
            window.minSize = new Vector2(320, 260);
            window.target = Selection.activeGameObject;
            window.Show();
        }

        [MenuItem("Jcreate++/.js を選んで、選択中のオブジェクトに設定する...", false, 20)]
        public static void PickAndApply()
        {
            var go = Selection.activeGameObject;
            if (go == null || EditorUtility.IsPersistent(go))
            {
                EditorUtility.DisplayDialog("Jcreate++", "先にヒエラルキーで、スクリプトを付けるオブジェクトを選んでください。", "OK");
                return;
            }
            var asset = PickScript();
            if (asset == null) return;
            var result = ItemSetup.Apply(go, asset);
            Selection.activeGameObject = go;
            var window = GetWindow<JcreateppWindow>("Jcreate++");
            window.script = asset;
            window.target = go;
            window.lastResult = result;
            window.Show();
        }

        [MenuItem("Jcreate++/.js を選んで、選択中のオブジェクトに設定する...", true)]
        static bool CanPickAndApply()
        {
            return Selection.activeGameObject != null && !EditorUtility.IsPersistent(Selection.activeGameObject);
        }

        /// <summary>Opens a file dialog for a .js and returns it as a JavaScript Asset (copied into the project when outside).</summary>
        static JavaScriptAsset PickScript()
        {
            var path = EditorUtility.OpenFilePanel("Jcreate++ のスクリプトを選ぶ", "", "js");
            if (string.IsNullOrEmpty(path)) return null;
            var assetPath = ToAssetPath(path);
            if (assetPath == null)
            {
                if (!AssetDatabase.IsValidFolder(ImportFolder))
                {
                    AssetDatabase.CreateFolder("Assets", Path.GetFileName(ImportFolder));
                }
                assetPath = ImportFolder + "/" + Path.GetFileName(path);
                if (File.Exists(assetPath) && !EditorUtility.DisplayDialog("Jcreate++",
                        "「" + assetPath + "」はもうあります。新しい内容で上書きしますか？", "上書きする", "やめる"))
                {
                    return null;
                }
                File.Copy(path, assetPath, true);
                // CCK's ScriptedImporter turns the .js into a JavaScriptAsset.
                AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
            }
            var asset = AssetDatabase.LoadAssetAtPath<JavaScriptAsset>(assetPath);
            if (asset == null)
            {
                EditorUtility.DisplayDialog("Jcreate++",
                    "「" + assetPath + "」を JavaScript Asset として読み込めませんでした。Cluster Creator Kit が入っているか確認してください。", "OK");
            }
            return asset;
        }

        /// <summary>"Assets/..." for a file inside this project, otherwise null.</summary>
        static string ToAssetPath(string fullPath)
        {
            var dataPath = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
            var full = Path.GetFullPath(fullPath).Replace('\\', '/');
            if (!full.StartsWith(dataPath + "/")) return null;
            return "Assets" + full.Substring(dataPath.Length);
        }

        void OnSelectionChange()
        {
            if (Selection.activeGameObject != null && !EditorUtility.IsPersistent(Selection.activeGameObject))
            {
                target = Selection.activeGameObject;
                lastResult = null;
                Repaint();
            }
        }

        void OnHierarchyChange()
        {
            Repaint();
        }

        void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);

            EditorGUILayout.LabelField("1. スクリプト", EditorStyles.boldLabel);
            EditorGUILayout.BeginHorizontal();
            script = (JavaScriptAsset)EditorGUILayout.ObjectField(script, typeof(JavaScriptAsset), false);
            if (GUILayout.Button("ファイルから選ぶ...", GUILayout.Width(120)))
            {
                var picked = PickScript();
                if (picked != null)
                {
                    script = picked;
                    lastResult = null;
                }
                GUIUtility.ExitGUI();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("2. 設定するオブジェクト", EditorStyles.boldLabel);
            target = (GameObject)EditorGUILayout.ObjectField(target, typeof(GameObject), true);

            EditorGUILayout.Space();
            using (new EditorGUI.DisabledScope(script == null || target == null || EditorUtility.IsPersistent(target)))
            {
                if (GUILayout.Button("3. このオブジェクトに設定する", GUILayout.Height(28)))
                {
                    lastResult = ItemSetup.Apply(target, script);
                }
            }
            if (script == null) EditorGUILayout.HelpBox("Jcreate++ の「JS保存」で保存した .js を選んでください。", MessageType.Info);
            else if (target == null) EditorGUILayout.HelpBox("ヒエラルキーでオブジェクトを選ぶと、ここに入ります。", MessageType.Info);

            if (lastResult != null)
            {
                EditorGUILayout.Space();
                EditorGUILayout.LabelField("設定したこと（元に戻す: Ctrl+Z）", EditorStyles.boldLabel);
                foreach (var line in lastResult.Done) EditorGUILayout.LabelField("・" + line, EditorStyles.wordWrappedLabel);
                foreach (var line in lastResult.Warnings) EditorGUILayout.HelpBox(line, MessageType.Warning);
            }

            if (script != null && target != null)
            {
                EditorGUILayout.Space();
                EditorGUILayout.LabelField("確認（手で設定するもの）", EditorStyles.boldLabel);
                List<SetupChecks.Check> checks = SetupChecks.Run(target, ScriptAnalysis.Analyze(script.text));
                foreach (var check in checks)
                {
                    EditorGUILayout.HelpBox(check.Text, check.Ok ? MessageType.None : MessageType.Warning);
                }
                EditorGUILayout.HelpBox("Scriptable Item はワールドのプレビューでは動きません。確かめるときはワールドをアップロードしてください。", MessageType.Info);
            }

            EditorGUILayout.EndScrollView();
        }
    }
}
