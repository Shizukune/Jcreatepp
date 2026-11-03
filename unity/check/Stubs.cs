// Compile-only stubs of the Unity / CCK APIs used by unity/Jcreatepp (signatures as in Unity 2021.3 / CCK 3.4).
// Bodies are empty: this only checks that the extension's code type-checks.
using System;
using System.Collections;

namespace UnityEngine
{
    public partial class Object { public string name; public static void DestroyImmediate(Object obj) { } public static implicit operator bool(Object o) { return o != null; } public static bool operator ==(Object a, Object b) { return ReferenceEquals(a, b); } public static bool operator !=(Object a, Object b) { return !ReferenceEquals(a, b); } public override bool Equals(object o) { return ReferenceEquals(this, o); } public override int GetHashCode() { return 0; } }
    public partial class Component : Object { public Transform transform; public GameObject gameObject; }
    public partial class Behaviour : Component { }
    public partial class MonoBehaviour : Behaviour { }
    public partial class ScriptableObject : Object { }
    public sealed partial class GameObject : Object
    {
        public GameObject(string name) { }
        public Transform transform;
        public T GetComponent<T>() { return default(T); }
        public T GetComponentInChildren<T>(bool includeInactive) { return default(T); }
    }
    public partial class Transform : Component, IEnumerable
    {
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 localPosition;
        public Quaternion localRotation;
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public IEnumerator GetEnumerator() { return null; }
    }
    public sealed partial class Rigidbody : Component { public bool isKinematic; public bool useGravity; }
    public partial class Collider : Component { }
    public partial struct Vector2 { public float x; public float y; public Vector2(float x, float y) { this.x = x; this.y = y; } }
    public partial struct Vector3
    {
        public float x; public float y; public float z;
        public static Vector3 zero; public static Vector3 one;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 operator +(Vector3 a, Vector3 b) { return a; }
    }
    public partial struct Quaternion
    {
        public static Quaternion identity;
        public Quaternion(float x, float y, float z, float w) { }
        public static Quaternion Euler(float x, float y, float z) { return identity; }
        public static Vector3 operator *(Quaternion rotation, Vector3 point) { return point; }
    }
    public static partial class Application { public static string dataPath; }
    public partial class GUIStyle { public static GUIStyle none; }
    public sealed partial class GUILayoutOption { }
    public static partial class GUILayout
    {
        public static bool Button(string text, params GUILayoutOption[] options) { return false; }
        public static bool Button(GUIContent content, params GUILayoutOption[] options) { return false; }
        public static bool Button(GUIContent content, GUIStyle style, params GUILayoutOption[] options) { return false; }
        public static bool Button(string text, GUIStyle style, params GUILayoutOption[] options) { return false; }
        public static void Label(string text, GUIStyle style, params GUILayoutOption[] options) { }
        public static void FlexibleSpace() { }
        public static GUILayoutOption Width(float w) { return null; }
        public static GUILayoutOption Height(float h) { return null; }
    }
    public static partial class GUIUtility { public static void ExitGUI() { } }
}

namespace UnityEditor
{
    using UnityEngine;

    public sealed partial class MenuItem : Attribute
    {
        public MenuItem(string itemName) { }
        public MenuItem(string itemName, bool isValidateFunction) { }
        public MenuItem(string itemName, bool isValidateFunction, int priority) { }
    }
    public partial class EditorWindow : ScriptableObject
    {
        public Vector2 minSize;
        public GUIContent titleContent;
        public Rect position;
        public static T GetWindow<T>(string title) where T : EditorWindow { return null; }
        public static T GetWindow<T>() where T : EditorWindow { return null; }
        public static T GetWindow<T>(bool utility, string title, bool focus) where T : EditorWindow { return null; }
        public static bool HasOpenInstances<T>() where T : EditorWindow { return false; }
        public void Close() { }
        public void Show() { }
        public void Repaint() { }
    }
    public static partial class Selection { public static GameObject activeGameObject; }
    public static partial class PrefabUtility { public static void RecordPrefabInstancePropertyModifications(Object targetObject) { } }
    public static partial class EditorUtility
    {
        public static bool IsPersistent(Object target) { return false; }
        public static bool DisplayDialog(string title, string message, string ok) { return true; }
        public static bool DisplayDialog(string title, string message, string ok, string cancel) { return true; }
        public static string OpenFilePanel(string title, string directory, string extension) { return null; }
    }
    public enum ImportAssetOptions { Default = 0, ForceUpdate = 1 }
    public static partial class AssetDatabase
    {
        public static bool IsValidFolder(string path) { return false; }
        public static string CreateFolder(string parentFolder, string newFolderName) { return null; }
        public static void ImportAsset(string path, ImportAssetOptions options) { }
        public static T LoadAssetAtPath<T>(string assetPath) where T : Object { return null; }
        public static string[] FindAssets(string filter) { return new string[0]; }
        public static string GUIDToAssetPath(string guid) { return null; }
    }
    public static partial class Undo
    {
        public static void IncrementCurrentGroup() { }
        public static int GetCurrentGroup() { return 0; }
        public static void SetCurrentGroupName(string name) { }
        public static T AddComponent<T>(GameObject gameObject) where T : Component { return null; }
        public static void RecordObject(Object objectToUndo, string name) { }
        public static void RegisterCreatedObjectUndo(Object objectToUndo, string name) { }
        public static void SetTransformParent(Transform transform, Transform newParent, string name) { }
        public static void CollapseUndoOperations(int groupIndex) { }
    }
    public partial class SerializedObject
    {
        public SerializedObject(Object obj) { }
        public SerializedProperty FindProperty(string propertyPath) { return null; }
        public bool ApplyModifiedProperties() { return true; }
    }
    public partial class SerializedProperty
    {
        public Object objectReferenceValue;
        public bool isArray;
        public int arraySize;
        public string stringValue;
        public SerializedProperty GetArrayElementAtIndex(int index) { return null; }
        public SerializedProperty FindPropertyRelative(string relativePropertyPath) { return null; }
    }
    public enum MessageType { None, Info, Warning, Error }
    public static partial class EditorStyles { public static GUIStyle boldLabel, wordWrappedLabel, toolbar, toolbarButton, toolbarPopup, miniLabel, miniBoldLabel, wordWrappedMiniLabel, miniButton; }
    public static partial class EditorGUILayout
    {
        public static Vector2 BeginScrollView(Vector2 scrollPosition, params GUILayoutOption[] options) { return scrollPosition; }
        public static void EndScrollView() { }
        public static void LabelField(string label, GUIStyle style, params GUILayoutOption[] options) { }
        public static void BeginHorizontal(params GUILayoutOption[] options) { }
        public static void BeginHorizontal(GUIStyle style, params GUILayoutOption[] options) { }
        public static void LabelField(string label, params GUILayoutOption[] options) { }
        public static Object ObjectField(GUIContent label, Object obj, Type objType, bool allowSceneObjects, params GUILayoutOption[] options) { return obj; }
        public static int Popup(int selectedIndex, string[] displayedOptions, GUIStyle style, params GUILayoutOption[] options) { return selectedIndex; }
        public static string TextField(GUIContent label, string text, params GUILayoutOption[] options) { return text; }
        public static bool Foldout(bool foldout, string content, bool toggleOnLabelClick) { return foldout; }
        public static Rect GetControlRect(params GUILayoutOption[] options) { return new Rect(); }
        public static void EndHorizontal() { }
        public static Object ObjectField(Object obj, Type objType, bool allowSceneObjects, params GUILayoutOption[] options) { return obj; }
        public static void Space() { }
        public static void HelpBox(string message, MessageType type) { }
    }
    public static partial class EditorGUI
    {
        public static int indentLevel;
        public static void BeginChangeCheck() { }
        public static bool EndChangeCheck() { return false; }
        public static Rect PrefixLabel(Rect totalPosition, GUIContent label) { return totalPosition; }
        public static void SelectableLabel(Rect position, string text) { }
        public partial struct DisabledScope : IDisposable
        {
            public DisabledScope(bool disabled) { }
            public void Dispose() { }
        }
    }
}

namespace ClusterVR.CreatorKit.Item.Implements
{
    using UnityEngine;

    public sealed partial class Item : MonoBehaviour { }
    public sealed partial class ScriptableItem : MonoBehaviour { }
    public sealed partial class MovableItem : MonoBehaviour { }
    public sealed partial class GrabbableItem : MonoBehaviour { }
    public sealed partial class RidableItem : MonoBehaviour { }
    public sealed partial class ItemAudioSetList : MonoBehaviour { }
    public sealed partial class WorldItemReferenceList : MonoBehaviour { }
    public sealed partial class JavaScriptAsset : ScriptableObject { public string text; }
}
