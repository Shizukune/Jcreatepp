using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor.Core
{
    /// <summary>Finds the core bundle (jcreatepp-core.txt) in the project, wherever the extension was put.</summary>
    public static class CoreBundle
    {
        const string Marker = "var JcreateppCore;";

        /// <summary>The bundle's text, or null when it is not in the project.</summary>
        public static string Load()
        {
            foreach (var guid in AssetDatabase.FindAssets("jcreatepp-core t:TextAsset"))
            {
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(AssetDatabase.GUIDToAssetPath(guid));
                // Only the real bundle: another asset with a similar name is skipped.
                if (asset != null && !string.IsNullOrEmpty(asset.text) && asset.text.Contains(Marker)) return asset.text;
            }
            return null;
        }
    }
}
