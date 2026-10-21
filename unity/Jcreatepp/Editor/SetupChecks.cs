using System.Collections.Generic;
using ClusterVR.CreatorKit.Item.Implements;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor
{
    /// <summary>
    /// 自動では設定できないもの（音の登録・参照の登録・サブノード・Collider など）が揃っているかを確かめる。
    /// 何も変更しない。
    /// </summary>
    public static class SetupChecks
    {
        public struct Check
        {
            public bool Ok;
            public string Text;

            public Check(bool ok, string text)
            {
                Ok = ok;
                Text = text;
            }
        }

        public static List<Check> Run(GameObject target, ScriptAnalysis a)
        {
            var checks = new List<Check>();
            if (target == null) return checks;

            if (a.UsesInteract || a.UsesGrab || a.UsesRide || a.UsesCollide)
            {
                var hasCollider = target.GetComponentInChildren<Collider>(true) != null;
                checks.Add(new Check(hasCollider, hasCollider
                    ? "Collider があります（クリック・つかむ・乗る・衝突に必要）"
                    : "Collider がありません。クリック・つかむ・乗る・衝突には Collider が必要です"));
            }

            foreach (var name in a.SubNodes)
            {
                var found = FindDescendant(target.transform, name) != null;
                checks.Add(new Check(found, found
                    ? "サブノード「" + name + "」があります"
                    : "子オブジェクト「" + name + "」がありません。同じ名前の子オブジェクトを作ってください"));
            }

            if (a.AudioIds.Count > 0)
            {
                var registered = RegisteredIds(target.GetComponent<ItemAudioSetList>(), "itemAudioSets", "id");
                foreach (var id in a.AudioIds)
                {
                    var ok = registered.Contains(id);
                    checks.Add(new Check(ok, ok
                        ? "音「" + id + "」が Item Audio Set List にあります"
                        : "Item Audio Set List に ID「" + id + "」で音を登録してください"));
                }
            }

            if (a.WorldItemReferenceIds.Count > 0)
            {
                var registered = RegisteredIds(target.GetComponent<WorldItemReferenceList>(), "worldItemReferences", "id");
                foreach (var id in a.WorldItemReferenceIds)
                {
                    var ok = registered.Contains(id);
                    checks.Add(new Check(ok, ok
                        ? "参照「" + id + "」が World Item Reference List にあります"
                        : "World Item Reference List に ID「" + id + "」で相手のアイテムを登録してください（ワールド専用）"));
                }
            }

            if (a.UsesRide)
            {
                checks.Add(new Check(true, "乗り物: 子オブジェクト「Seat」の位置と向きを、座らせたい場所に合わせてください"));
            }

            if (a.UsesUnityComponent)
            {
                checks.Add(new Check(true, "サブノードの Unity コンポーネントを操作しています。ワールドに置くアイテムでのみ動きます（クラフトアイテムでは使えません）"));
            }

            var fits = a.Bytes <= ScriptAnalysis.CraftItemMaxBytes;
            checks.Add(new Check(fits, "スクリプトの大きさ: " + a.Bytes.ToString("N0") + " / " + ScriptAnalysis.CraftItemMaxBytes.ToString("N0")
                + " バイト（クラフトアイテムの上限）" + (fits ? "" : "。ワールドに置くアイテムとしては使えます")));
            return checks;
        }

        static Transform FindDescendant(Transform root, string name)
        {
            foreach (Transform child in root)
            {
                if (child.name == name) return child;
                var found = FindDescendant(child, name);
                if (found != null) return found;
            }
            return null;
        }

        /// <summary>IDs of a list component (read through serialization; the fields are private in CCK).</summary>
        static HashSet<string> RegisteredIds(Object component, string arrayField, string idField)
        {
            var ids = new HashSet<string>();
            if (component == null) return ids;
            var array = new SerializedObject(component).FindProperty(arrayField);
            if (array == null || !array.isArray) return ids;
            for (var i = 0; i < array.arraySize; i++)
            {
                var id = array.GetArrayElementAtIndex(i).FindPropertyRelative(idField);
                if (id != null) ids.Add(id.stringValue);
            }
            return ids;
        }
    }
}
