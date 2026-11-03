// Compile-only stubs of the extra Unity APIs used by Editor/Blocks (signatures as in Unity 2021.3).
// Used with Stubs.cs and PreviewStubs.cs by check.ps1; bodies are empty.
using System;

namespace UnityEngine
{
    public enum TextAnchor { MiddleLeft = 3, MiddleCenter = 4 }
    public enum KeyCode { Backspace = 8, Escape = 27, Delete = 127 }
    public partial class ScriptableObject
    {
        public HideFlags hideFlags;
        public static T CreateInstance<T>() where T : ScriptableObject { return null; }
    }
    public sealed class Texture2D : Texture { public static Texture2D whiteTexture; }
    public partial struct Color
    {
        public Color(float r, float g, float b) { }
        public static Color white, black, red, gray;
        public static Color Lerp(Color a, Color b, float t) { return a; }
    }
    public static class ColorUtility { public static bool TryParseHtmlString(string htmlString, out Color color) { color = new Color(); return false; } }
    public partial struct Vector2
    {
        public static Vector2 zero;
        public static Vector2 operator +(Vector2 a, Vector2 b) { return a; }
        public static Vector2 operator -(Vector2 a, Vector2 b) { return a; }
        public static Vector2 operator *(Vector2 a, float d) { return a; }
        public float magnitude { get { return 0; } }
    }
    public partial struct Rect
    {
        public Rect(float x, float y, float width, float height) { this.x = x; this.y = y; this.width = width; this.height = height; }
        public float x, y, height;
        public float yMin { get { return y; } set { y = value; } }
        public Vector2 position { get { return new Vector2(x, y); } }
    }
    public static partial class Mathf
    {
        public static float Repeat(float t, float length) { return t; }
        public static int Clamp(int value, int min, int max) { return value; }
    }
    public sealed class RectOffset { public RectOffset(int left, int right, int top, int bottom) { } }
    public sealed class GUIStyleState { public Color textColor; public Texture2D background; }
    public partial class GUIStyle
    {
        public GUIStyle() { }
        public GUIStyle(GUIStyle other) { }
        public int fontSize;
        public TextAnchor alignment;
        public RectOffset padding, margin;
        public float fixedHeight;
        public bool wordWrap;
        public GUIStyleState normal, focused;
        public Vector2 CalcSize(GUIContent content) { return new Vector2(); }
    }
    public partial class Event
    {
        public EventType rawType;
        public KeyCode keyCode;
        public bool shift;
        public string commandName;
    }
    public static class GUI
    {
        public static void Label(Rect position, string text, GUIStyle style) { }
        public static void Label(Rect position, GUIContent content) { }
        public static bool Toggle(Rect position, bool value, GUIContent content, GUIStyle style) { return value; }
        public static void DrawTexture(Rect position, Texture image, ScaleMode scaleMode, bool alphaBlend, float imageAspect, Color color, float borderWidth, float borderRadius) { }
        public static void BeginGroup(Rect position) { }
        public static void EndGroup() { }
        public static void FocusControl(string name) { }
    }
    public static partial class GUILayout
    {
        public static void BeginArea(Rect screenRect) { }
        public static void BeginArea(Rect screenRect, GUIStyle style) { }
        public static void EndArea() { }
        public static Vector2 BeginScrollView(Vector2 scrollPosition, params GUILayoutOption[] options) { return scrollPosition; }
        public static void EndScrollView() { }
        public static void Space(float pixels) { }
        public static GUILayoutOption MinWidth(float minWidth) { return null; }
    }
    public static partial class GUIUtility { public static int keyboardControl; }
    public static partial class GUILayoutUtility
    {
        public static Rect GetRect(float width, float height) { return new Rect(); }
        public static Rect GetRect(GUIContent content, GUIStyle style, params GUILayoutOption[] options) { return new Rect(); }
    }
}

namespace UnityEditor
{
    using UnityEngine;

    public partial class EditorWindow
    {
        public bool wantsMouseMove { get; set; }
        public bool hasUnsavedChanges { get; set; }
        public string saveChangesMessage { get; set; }
        public virtual void SaveChanges() { }
        public virtual void DiscardChanges() { }
    }
    public sealed class GenericMenu
    {
        public delegate void MenuFunction();
        public void AddItem(GUIContent content, bool on, MenuFunction func) { }
        public void AddDisabledItem(GUIContent content) { }
        public void AddSeparator(string path) { }
        public void ShowAsContext() { }
    }
    public static partial class EditorStyles { public static GUIStyle helpBox, textField, textArea, popup, centeredGreyMiniLabel, whiteBoldLabel; }
    public static partial class EditorUtility
    {
        public static int DisplayDialogComplex(string title, string message, string ok, string cancel, string alt) { return 0; }
        public static Object InstanceIDToObject(int instanceID) { return null; }
        public static string SaveFilePanelInProject(string title, string defaultName, string extension, string message, string path) { return null; }
    }
    public static partial class AssetDatabase
    {
        public static string GetAssetPath(int instanceID) { return null; }
        public static string GetAssetPath(Object assetObject) { return null; }
        public static void ImportAsset(string path) { }
    }
    public static partial class Undo
    {
        public delegate void UndoRedoCallback();
        public static UndoRedoCallback undoRedoPerformed;
        public static void ClearUndo(Object identifier) { }
    }
    public static partial class EditorGUI
    {
        public static void DrawRect(Rect rect, Color color) { }
        public static string DelayedTextField(Rect position, string text, GUIStyle style) { return text; }
        public static int Popup(Rect position, int selectedIndex, string[] displayedOptions, GUIStyle style) { return selectedIndex; }
        public static bool Toggle(Rect position, bool value) { return value; }
    }
    public static partial class EditorGUILayout
    {
        public static void BeginVertical(GUIStyle style, params GUILayoutOption[] options) { }
        public static void EndVertical() { }
        public static int Popup(string label, int selectedIndex, string[] displayedOptions, params GUILayoutOption[] options) { return selectedIndex; }
        public static double DoubleField(string label, double value, params GUILayoutOption[] options) { return value; }
        public static bool ToggleLeft(string label, bool value, GUIStyle labelStyle, params GUILayoutOption[] options) { return value; }
        public static void SelectableLabel(string text, GUIStyle style, params GUILayoutOption[] options) { }
    }
}

namespace UnityEditor.Callbacks
{
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class OnOpenAssetAttribute : Attribute { public OnOpenAssetAttribute(int callbackOrder) { } }
}
