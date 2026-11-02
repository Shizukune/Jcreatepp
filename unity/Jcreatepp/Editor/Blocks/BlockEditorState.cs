using UnityEngine;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>
    /// What the block editor is editing. Kept in an object (not in the window) so Unity's Undo / Redo
    /// (Ctrl+Z / Ctrl+Y) records each change, and so it survives script reloads. Not saved in the project.
    /// Only the blocks are here: where they are saved and what the file has stay in the window, so Undo never
    /// moves them back.
    /// </summary>
    public sealed class BlockEditorState : ScriptableObject
    {
        /// <summary>The workspace in Blockly's save format; "" for an empty one.</summary>
        public string Json = "";

        /// <summary>
        /// Whether blocks <paramref name="json"/> are not in a file yet: never saved (<paramref name="assetPath"/> "")
        /// and not empty, or not what was last saved to / opened from it (<paramref name="savedJson"/>).
        /// </summary>
        public static bool Unsaved(string json, string assetPath, string savedJson)
        {
            return assetPath == "" ? json != "" : json != savedJson;
        }
    }
}
