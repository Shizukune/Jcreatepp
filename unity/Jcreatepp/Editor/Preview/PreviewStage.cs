using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor.Preview
{
    /// <summary>
    /// Draws the preview inside the window with PreviewRenderUtility (the same mechanism as the
    /// model preview at the bottom of the Inspector). Nothing is added to the open scene.
    /// Looks like the Scene view: gray background, thin gray grid, a light gray cube and the
    /// item's local axes in Unity's gizmo colors (X red, Y green, Z = front blue).
    /// Everything is drawn with DrawMesh for the current frame only; no GameObjects are created.
    /// </summary>
    public sealed class PreviewStage : IDisposable
    {
        PreviewRenderUtility utility;
        readonly Mesh cube;
        Mesh grid;
        Mesh axes;
        Material solid;
        Material lines;

        /// <summary>Camera orbit around <see cref="Pivot"/>: degrees, degrees, metres.</summary>
        public float Yaw = 35f;
        public float Pitch = 25f;
        public float Distance = 6f;
        public Vector3 Pivot = Vector3.zero;

        public PreviewStage()
        {
            utility = new PreviewRenderUtility();
            var camera = utility.camera;
            utility.cameraFieldOfView = 30f;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 500f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            utility.lights[0].intensity = 1.1f;
            utility.lights[0].transform.rotation = Quaternion.Euler(50f, 30f, 0f);
            utility.lights[1].intensity = 0.5f;
            utility.ambientColor = new Color(0.3f, 0.3f, 0.3f, 1f);

            cube = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
            var standard = Shader.Find("Standard");
            var colored = Shader.Find("Hidden/Internal-Colored");
            solid = new Material(standard != null ? standard : colored);
            solid.hideFlags = HideFlags.HideAndDontSave;
            solid.color = new Color(0.78f, 0.78f, 0.78f, 1f); // like Unity's Default-Material
            lines = new Material(colored);
            lines.hideFlags = HideFlags.HideAndDontSave;
            lines.SetInt("_ZWrite", 1);
            lines.SetInt("_Cull", 0);
            grid = BuildGrid();
            axes = BuildAxes();
        }

        /// <summary>Handles orbit (left drag) and zoom (wheel) inside <paramref name="rect"/>. True when something changed.</summary>
        public bool HandleInput(Rect rect)
        {
            var e = Event.current;
            if (!rect.Contains(e.mousePosition)) return false;
            if (e.type == EventType.MouseDrag && e.button == 0)
            {
                Yaw += e.delta.x * 0.5f;
                Pitch = Mathf.Clamp(Pitch + e.delta.y * 0.5f, -10f, 89f);
                e.Use();
                return true;
            }
            if (e.type == EventType.ScrollWheel)
            {
                Distance = Mathf.Clamp(Distance * (1f + e.delta.y * 0.05f), 2f, 60f);
                e.Use();
                return true;
            }
            return false;
        }

        /// <summary>Draws the item at <paramref name="position"/> / <paramref name="rotation"/> (Cluster = Unity coordinates).</summary>
        public void Draw(Rect rect, Vector3 position, Quaternion rotation)
        {
            if (Event.current.type != EventType.Repaint || utility == null) return;
            utility.BeginPreview(rect, GUIStyle.none);
            try
            {
                var camera = utility.camera;
                camera.backgroundColor = EditorGUIUtility.isProSkin ? new Color(0.19f, 0.19f, 0.19f, 1f) : new Color(0.76f, 0.76f, 0.76f, 1f);
                var orbit = Quaternion.Euler(Pitch, Yaw, 0f);
                camera.transform.rotation = orbit;
                camera.transform.position = Pivot + orbit * new Vector3(0f, 0f, -Distance);

                // The ground: half a cube below the start position, so the cube stands on it.
                utility.DrawMesh(grid, Matrix4x4.TRS(new Vector3(Pivot.x, Pivot.y - 0.5f, Pivot.z), Quaternion.identity, Vector3.one), lines, 0);
                var item = Matrix4x4.TRS(position, rotation, Vector3.one);
                utility.DrawMesh(cube, item, solid, 0);
                utility.DrawMesh(axes, item, lines, 0);
                // Render() (not camera.Render()) turns on the preview's own lights for this frame.
                utility.Render(false, true);
            }
            finally
            {
                utility.EndAndDrawPreview(rect);
            }
        }

        static Mesh BuildGrid()
        {
            const int half = 10;
            var vertices = new List<Vector3>();
            var colors = new List<Color>();
            var minor = new Color(0.5f, 0.5f, 0.5f, 0.35f);
            var major = new Color(0.5f, 0.5f, 0.5f, 0.8f);
            for (var i = -half; i <= half; i++)
            {
                var c = i == 0 ? major : minor;
                vertices.Add(new Vector3(i, 0f, -half));
                vertices.Add(new Vector3(i, 0f, half));
                vertices.Add(new Vector3(-half, 0f, i));
                vertices.Add(new Vector3(half, 0f, i));
                colors.Add(c); colors.Add(c); colors.Add(c); colors.Add(c);
            }
            return LineMesh("Jcreate++ grid", vertices, colors);
        }

        static Mesh BuildAxes()
        {
            const float length = 1.2f;
            var vertices = new List<Vector3>
            {
                Vector3.zero, new Vector3(length, 0f, 0f),
                Vector3.zero, new Vector3(0f, length, 0f),
                Vector3.zero, new Vector3(0f, 0f, length),
            };
            // Unity's handle colors: X red, Y green, Z blue (front).
            var x = new Color(0.86f, 0.24f, 0.18f, 1f);
            var y = new Color(0.55f, 0.83f, 0.25f, 1f);
            var z = new Color(0.22f, 0.49f, 0.95f, 1f);
            var colors = new List<Color> { x, x, y, y, z, z };
            return LineMesh("Jcreate++ axes", vertices, colors);
        }

        static Mesh LineMesh(string name, List<Vector3> vertices, List<Color> colors)
        {
            var mesh = new Mesh();
            mesh.name = name;
            mesh.hideFlags = HideFlags.HideAndDontSave;
            mesh.SetVertices(vertices);
            mesh.SetColors(colors);
            var indices = new int[vertices.Count];
            for (var i = 0; i < indices.Length; i++) indices[i] = i;
            mesh.SetIndices(indices, MeshTopology.Lines, 0);
            return mesh;
        }

        public void Dispose()
        {
            if (utility != null)
            {
                utility.Cleanup();
                utility = null;
            }
            DestroyOwned(grid);
            DestroyOwned(axes);
            DestroyOwned(solid);
            DestroyOwned(lines);
            grid = axes = null;
            solid = lines = null;
        }

        static void DestroyOwned(UnityEngine.Object o)
        {
            if (o != null) UnityEngine.Object.DestroyImmediate(o);
        }
    }
}
