using System.Collections.Generic;
using ClusterVR.CreatorKit.Item.Implements;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor
{
    /// <summary>
    /// 選んだオブジェクトに、Jcreate++ のスクリプトを動かすためのコンポーネントを付ける。
    /// 足すだけで、既にあるコンポーネントは消さない。全部で 1 回の Undo（Ctrl+Z）で戻せる。
    /// </summary>
    public static class ItemSetup
    {
        public sealed class Result
        {
            public readonly List<string> Done = new List<string>();
            public readonly List<string> Warnings = new List<string>();
        }

        public static Result Apply(GameObject target, JavaScriptAsset script)
        {
            var result = new Result();
            var analysis = ScriptAnalysis.Analyze(script.text);

            Undo.IncrementCurrentGroup();
            var group = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("Jcreate++ セットアップ");

            if (target.GetComponent<Item>() == null)
            {
                Undo.AddComponent<Item>(target);
                result.Done.Add("Item を付けました");
            }

            var scriptable = target.GetComponent<ScriptableItem>();
            if (scriptable == null)
            {
                scriptable = Undo.AddComponent<ScriptableItem>(target);
                result.Done.Add("Scriptable Item を付けました");
            }
            // ScriptableItem keeps the asset in a private serialized field; set it like the Inspector does.
            var serialized = new SerializedObject(scriptable);
            var assetProperty = serialized.FindProperty("sourceCodeAsset");
            if (assetProperty == null)
            {
                result.Warnings.Add("Scriptable Item の Source Code Asset が見つかりません（Cluster Creator Kit のバージョンが想定と違う可能性があります）。手で設定してください。");
            }
            else
            {
                if (assetProperty.objectReferenceValue != null && assetProperty.objectReferenceValue != script)
                {
                    result.Done.Add("前に設定されていたスクリプトを置き換えました");
                }
                assetProperty.objectReferenceValue = script;
                serialized.ApplyModifiedProperties();
                result.Done.Add("Source Code Asset に「" + script.name + "」を設定しました");
            }

            // Grabbable Item and Ridable Item cannot be on the same item: check the script and what is already there.
            var addGrab = analysis.UsesGrab;
            var addRide = analysis.UsesRide;
            if (addGrab && addRide)
            {
                result.Warnings.Add("つかむイベントと乗り物は同じアイテムで使えません（Grabbable Item と Ridable Item は併用不可）。どちらも付けていません。");
                addGrab = addRide = false;
            }
            if (addGrab && target.GetComponent<RidableItem>() != null)
            {
                result.Warnings.Add("このオブジェクトには Ridable Item が付いています。つかむイベントには Grabbable Item が要りますが、併用できないので付けていません。Ridable Item を外すか、別のオブジェクトに設定してください。");
                addGrab = false;
            }
            if (addRide && target.GetComponent<GrabbableItem>() != null)
            {
                result.Warnings.Add("このオブジェクトには Grabbable Item が付いています。乗り物には Ridable Item が要りますが、併用できないので付けていません。Grabbable Item を外すか、別のオブジェクトに設定してください。");
                addRide = false;
            }

            if (analysis.NeedsMovable)
            {
                if (target.GetComponent<MovableItem>() == null)
                {
                    // MovableItem requires a Rigidbody; Undo.AddComponent adds it too.
                    Undo.AddComponent<MovableItem>(target);
                    result.Done.Add("Movable Item（と Rigidbody）を付けました");
                }
                var body = target.GetComponent<Rigidbody>();
                if (body != null)
                {
                    Undo.RecordObject(body, "Jcreate++ Rigidbody");
                    body.isKinematic = !analysis.PhysicsDriven;
                    body.useGravity = analysis.PhysicsDriven;
                    // Direct assignment on a prefab instance is not saved as an override without this.
                    PrefabUtility.RecordPrefabInstancePropertyModifications(body);
                    result.Done.Add(analysis.PhysicsDriven
                        ? "Rigidbody を物理で動く設定にしました（Is Kinematic オフ・Use Gravity オン）"
                        : "Rigidbody の Is Kinematic をオンにしました（スクリプトで動かすため）");
                }
                if (analysis.MovesByScript && (analysis.UsesForce || analysis.UsesCollide))
                {
                    result.Warnings.Add("スクリプトで位置を変えつつ、力や衝突も使っています。Is Kinematic をオンにしたので、力・衝突は思ったように効かないかもしれません。");
                }
            }

            if (addGrab && target.GetComponent<GrabbableItem>() == null)
            {
                Undo.AddComponent<GrabbableItem>(target);
                result.Done.Add("Grabbable Item を付けました");
            }

            if (addRide)
            {
                var ridable = target.GetComponent<RidableItem>();
                var added = false;
                if (ridable == null)
                {
                    ridable = Undo.AddComponent<RidableItem>(target);
                    added = true;
                    result.Done.Add("Ridable Item を付けました");
                }
                AssignSeat(ridable, added, result);
            }

            Undo.CollapseUndoOperations(group);
            return result;
        }

        /// <summary>
        /// Ridable Item needs a seat transform. CCK's Reset() points it at the item itself, so a newly
        /// added Ridable Item (or an empty seat) gets a child "Seat"; a seat someone already set is kept.
        /// </summary>
        static void AssignSeat(RidableItem ridable, bool justAdded, Result result)
        {
            var serialized = new SerializedObject(ridable);
            var seat = serialized.FindProperty("seat");
            if (seat == null)
            {
                result.Warnings.Add("Ridable Item の Seat が見つかりません。手で設定してください。");
                return;
            }
            var current = seat.objectReferenceValue;
            var isDefault = current == null || (justAdded && current == ridable.transform);
            if (!isDefault) return;
            // Finish the object (parent, position, rotation) before registering its creation, so that
            // Undo removes it and Redo brings it back exactly like this.
            var child = new GameObject("Seat");
            child.transform.SetParent(ridable.transform, false);
            child.transform.localPosition = new Vector3(0f, 0.5f, 0f);
            child.transform.localRotation = Quaternion.identity;
            Undo.RegisterCreatedObjectUndo(child, "Jcreate++ Seat");
            seat.objectReferenceValue = child.transform;
            serialized.ApplyModifiedProperties();
            result.Done.Add("座る位置として子オブジェクト「Seat」を作りました（位置は調整してください）");
        }
    }
}
