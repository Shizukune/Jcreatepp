// Compile-only stubs of the Unity / CCK APIs used by unity/Jcreatepp (signatures as in Unity 2021.3 / CCK 3.4).
// Bodies are empty: this only checks that the extension's code type-checks.
using System;
using System.Collections;

namespace UnityEngine
{
    public class Object { public string name; public static implicit operator bool(Object o) { return o != null; } public static bool operator ==(Object a, Object b) { return ReferenceEquals(a, b); } public static bool operator !=(Object a, Object b) { return !ReferenceEquals(a, b); } public override bool Equals(object o) { return ReferenceEquals(this, o); } public override int GetHashCode() { return 0; } }
    public class Component : Object { public Transform transform; public GameObject gameObject; }
    public class Behaviour : Component { }
    public class MonoBehaviour : Behaviour { }
    public class ScriptableObject : Object { }
    public sealed class GameObject : Object
    {
        public GameObject(string name) { }
        public Transform transform;
        public T GetComponent<T>() { return default(T); }
        public T GetComponentInChildren<T>(bool includeInactive) { return default(T); }
    }
    public class Transform : Component, IEnumerable
    {
        public Vector3 localPosition;
        public Quaternion localRotation;
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public IEnumerator GetEnumerator() { return null; }
    }
    public sealed class Rigidbody : Component { public bool isKinematic; public bool useGravity; }
    public class Collider : Component { }
    public struct Vector2 { public Vector2(float x, float y) { } }
    public struct Vector3 { public Vector3(float x, float y, float z) { } }
    public struct Quaternion { public static Quaternion identity; }
    public static class Application { public static string dataPath; }
    public class GUIStyle { }
    public sealed class GUILayoutOption { }
    public static class GUILayout
    {
        public static bool Button(string text, params GUILayoutOption[] options) { return false; }
        public static GUILayoutOption Width(float w) { return null; }
        public static GUILayoutOption Height(float h) { return null; }
    }
    public static class GUIUtility { public static void ExitGUI() { } }
}

namespace UnityEditor
{
    using UnityEngine;

    public sealed class MenuItem : Attribute
    {
        public MenuItem(string itemName) { }
        public MenuItem(string itemName, bool isValidateFunction) { }
        public MenuItem(string itemName, bool isValidateFunction, int priority) { }
    }
    public class EditorWindow : ScriptableObject
    {
        public Vector2 minSize;
        public static T GetWindow<T>(string title) where T : EditorWindow { return null; }
        public void Show() { }
        public void Repaint() { }
    }
    public static class Selection { public static GameObject activeGameObject; }
    public static class PrefabUtility { public static void RecordPrefabInstancePropertyModifications(Object targetObject) { } }
    public static class EditorUtility
    {
        public static bool IsPersistent(Object target) { return false; }
        public static bool DisplayDialog(string title, string message, string ok) { return true; }
        public static bool DisplayDialog(string title, string message, string ok, string cancel) { return true; }
        public static string OpenFilePanel(string title, string directory, string extension) { return null; }
    }
    public enum ImportAssetOptions { Default = 0, ForceUpdate = 1 }
    public static class AssetDatabase
    {
        public static bool IsValidFolder(string path) { return false; }
        public static string CreateFolder(string parentFolder, string newFolderName) { return null; }
        public static void ImportAsset(string path, ImportAssetOptions options) { }
        public static T LoadAssetAtPath<T>(string assetPath) where T : Object { return null; }
    }
    public static class Undo
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
    public class SerializedObject
    {
        public SerializedObject(Object obj) { }
        public SerializedProperty FindProperty(string propertyPath) { return null; }
        public bool ApplyModifiedProperties() { return true; }
    }
    public class SerializedProperty
    {
        public Object objectReferenceValue;
        public bool isArray;
        public int arraySize;
        public string stringValue;
        public SerializedProperty GetArrayElementAtIndex(int index) { return null; }
        public SerializedProperty FindPropertyRelative(string relativePropertyPath) { return null; }
    }
    public enum MessageType { None, Info, Warning, Error }
    public static class EditorStyles { public static GUIStyle boldLabel; public static GUIStyle wordWrappedLabel; }
    public static class EditorGUILayout
    {
        public static Vector2 BeginScrollView(Vector2 scrollPosition, params GUILayoutOption[] options) { return scrollPosition; }
        public static void EndScrollView() { }
        public static void LabelField(string label, GUIStyle style, params GUILayoutOption[] options) { }
        public static void BeginHorizontal(params GUILayoutOption[] options) { }
        public static void EndHorizontal() { }
        public static Object ObjectField(Object obj, Type objType, bool allowSceneObjects, params GUILayoutOption[] options) { return obj; }
        public static void Space() { }
        public static void HelpBox(string message, MessageType type) { }
    }
    public static class EditorGUI
    {
        public struct DisabledScope : IDisposable
        {
            public DisabledScope(bool disabled) { }
            public void Dispose() { }
        }
    }
}

namespace ClusterVR.CreatorKit.Item.Implements
{
    using UnityEngine;

    public sealed class Item : MonoBehaviour { }
    public sealed class ScriptableItem : MonoBehaviour { }
    public sealed class MovableItem : MonoBehaviour { }
    public sealed class GrabbableItem : MonoBehaviour { }
    public sealed class RidableItem : MonoBehaviour { }
    public sealed class ItemAudioSetList : MonoBehaviour { }
    public sealed class WorldItemReferenceList : MonoBehaviour { }
    public sealed class JavaScriptAsset : ScriptableObject { public string text; }
}
