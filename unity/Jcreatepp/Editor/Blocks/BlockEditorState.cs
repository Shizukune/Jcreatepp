using UnityEngine;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>
    /// What the block editor is editing. Kept in an object (not in the window) so Unity's Undo / Redo
    /// (Ctrl+Z / Ctrl+Y) records each change, and so it survives script reloads. Not saved in the project.
    /// </summary>
    public sealed class BlockEditorState : ScriptableObject
    {
        /// <summary>The workspace in Blockly's save format; "" for an empty one.</summary>
        public string Json = "";
        /// <summary>"Assets/....json" where it is saved; "" before the first save.</summary>
        public string AssetPath = "";
        /// <summary>Changed since the last save.</summary>
        public bool Dirty;
    }
}
