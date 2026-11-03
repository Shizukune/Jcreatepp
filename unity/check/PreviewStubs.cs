// Compile-only stubs of the extra Unity APIs used by Editor/Preview (signatures as in Unity 2021.3).
// Used with Stubs.cs by check.ps1; bodies are empty.
using System;
using System.Collections.Generic;

namespace UnityEngine
{
    public sealed partial class SerializeField : Attribute { }
    public partial class Texture : Object { }
    public sealed partial class TextAsset : Object { public string text; }
    public sealed partial class Shader : Object { public static Shader Find(string name) { return null; } }
    public enum HideFlags { None = 0, HideAndDontSave = 61 }
    public enum MeshTopology { Triangles = 0, Lines = 3 }
    public enum CameraClearFlags { Skybox = 1, SolidColor = 2 }
    public enum EventType { MouseDown = 0, MouseUp = 1, MouseDrag = 3, KeyDown = 4, ScrollWheel = 6, Repaint = 7, ValidateCommand = 13, ExecuteCommand = 14 }
    public enum ScaleMode { StretchToFill = 0 }
    public partial struct Color { public Color(float r, float g, float b, float a) { } }
    public partial struct Rect { public float width; public bool Contains(Vector2 point) { return false; } }
    public partial struct Matrix4x4
    {
        public static Matrix4x4 identity;
        public static Matrix4x4 TRS(Vector3 pos, Quaternion q, Vector3 s) { return identity; }
    }
    public static partial class Mathf { public static float Clamp(float value, float min, float max) { return value; } }
    public partial class Material : Object
    {
        public Material(Shader shader) { }
        public HideFlags hideFlags;
        public Color color;
        public void SetInt(string name, int value) { }
    }
    public sealed partial class Mesh : Object
    {
        public HideFlags hideFlags;
        public void SetVertices(List<Vector3> inVertices) { }
        public void SetColors(List<Color> inColors) { }
        public void SetIndices(int[] indices, MeshTopology topology, int submesh) { }
    }
    public sealed partial class Camera : Behaviour
    {
        public float nearClipPlane;
        public float farClipPlane;
        public CameraClearFlags clearFlags;
        public Color backgroundColor;
    }
    public sealed partial class Light : Behaviour { public float intensity; }
    public static partial class Resources { public static T GetBuiltinResource<T>(string path) where T : Object { return null; } }
    public sealed partial class Event
    {
        public static Event current;
        public EventType type;
        public Vector2 mousePosition;
        public Vector2 delta;
        public int button;
        public void Use() { }
    }
    public partial class GUIContent
    {
        public Texture image;
        public GUIContent() { }
        public GUIContent(string text) { }
        public GUIContent(string text, string tooltip) { }
        public GUIContent(string text, Texture image, string tooltip) { }
    }
    public static partial class GUILayoutUtility { public static Rect GetRect(float minWidth, float maxWidth, float minHeight, float maxHeight) { return new Rect(); } }
}

namespace UnityEditor
{
    using UnityEngine;

    public enum PlayModeStateChange { EnteredEditMode, ExitingEditMode, EnteredPlayMode, ExitingPlayMode }
    public static partial class EditorApplication
    {
        public static Action update;
        public static Action<PlayModeStateChange> playModeStateChanged;
        public static double timeSinceStartup;
    }
    public static partial class AssemblyReloadEvents
    {
        public delegate void AssemblyReloadCallback();
        public static event AssemblyReloadCallback beforeAssemblyReload;
        static void Touch() { if (beforeAssemblyReload != null) beforeAssemblyReload(); }
    }
    public partial class PreviewRenderUtility
    {
        public Camera camera;
        public Light[] lights;
        public Color ambientColor;
        public float cameraFieldOfView;
        public void BeginPreview(Rect r, GUIStyle previewBackground) { }
        public void EndAndDrawPreview(Rect r) { }
        public void Render(bool allowScriptableRenderPipeline, bool updatefov) { }
        public void DrawMesh(Mesh mesh, Matrix4x4 matrix, Material mat, int subMeshIndex) { }
        public void Cleanup() { }
    }
    public static partial class EditorGUIUtility
    {
        public static bool isProSkin;
        public static GUIContent IconContent(string name) { return new GUIContent(); }
    }
}
