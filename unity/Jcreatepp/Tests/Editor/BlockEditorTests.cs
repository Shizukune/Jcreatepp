using System.Collections.Generic;
using Jcreatepp.Editor.Blocks;
using Jcreatepp.Editor.Core;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor.Preview.Tests
{
    /// <summary>
    /// EditMode tests for the block editor (Jcreate++ > ブロックエディター): the palette and block shapes come
    /// from the core, edits make the same saved JSON and code as the Web editor would, and drops connect
    /// where Blockly would let them. The window itself (mouse, drawing) is not tested here.
    /// </summary>
    public sealed class BlockEditorTests
    {
        /// <summary>Saved by the Web editor: number inputs hold math_number shadows (every palette block with a number does).</summary>
        const string WithShadows =
            "{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_start\",\"id\":\"ev\",\"x\":10,\"y\":20," +
            "\"inputs\":{\"DO\":{\"block\":{\"type\":\"jcreatepp_set_position\",\"id\":\"p\",\"inputs\":{" +
            "\"X\":{\"shadow\":{\"type\":\"math_number\",\"id\":\"a\",\"fields\":{\"NUM\":1}}}," +
            "\"Y\":{\"shadow\":{\"type\":\"math_number\",\"id\":\"b\",\"fields\":{\"NUM\":2.5}}}," +
            "\"Z\":{\"shadow\":{\"type\":\"math_number\",\"id\":\"c\",\"fields\":{\"NUM\":-3}}," +
            "\"block\":{\"type\":\"jcreatepp_number_var\",\"id\":\"v\",\"fields\":{\"VAR_NAME\":\"z\"}}}}}}}}]}," +
            "\"variables\":[]}";

        static string Bundle()
        {
            var bundle = CoreBundle.Load();
            if (bundle == null) Assert.Fail("jcreatepp-core.txt not found");
            return bundle;
        }

        static string Toolbox()
        {
            foreach (var guid in AssetDatabase.FindAssets("jcreatepp-toolbox t:TextAsset"))
            {
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (asset != null && asset.text.Contains("\"categoryToolbox\"")) return asset.text;
            }
            Assert.Fail("jcreatepp-toolbox.json not found");
            return null;
        }

        static BlockCatalog Catalog(CoreHost core)
        {
            Assert.AreEqual("", core.EditorUnavailableReason);
            string error;
            var catalog = BlockCatalog.Load(core, Toolbox(), out error);
            Assert.IsNotNull(catalog, error);
            return catalog;
        }

        static PaletteItem Item(BlockCatalog catalog, string type)
        {
            foreach (var c in catalog.Categories)
            {
                foreach (var i in c.Items)
                {
                    if (i.Kind == "block" && i.Type == type) return i;
                }
            }
            Assert.Fail(type + " is not in the palette");
            return null;
        }

        /// <summary>Fixed text widths, so layout does not depend on fonts.</summary>
        static float Measure(string text)
        {
            return text.Length * 7f;
        }

        [Test]
        public void ConvertsBlocksWithShadows()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var r = core.Convert(WithShadows);
                Assert.IsTrue(r.Ok, r.Error);
                CollectionAssert.IsEmpty(r.Errors);
                StringAssert.Contains("$.setPosition(new Vector3(1, 2.5, ", r.Code);
                Assert.IsFalse(core.IsStopped);
            }
        }

        [Test]
        public void PaletteHasEveryCategoryAndEachBlockConverts()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var catalog = Catalog(core);
                Assert.AreEqual(9, catalog.Categories.Count);
                var blocks = 0;
                foreach (var c in catalog.Categories)
                {
                    StringAssert.StartsWith("#", c.Colour, c.Name);
                    foreach (var item in c.Items)
                    {
                        if (item.Kind != "block") continue;
                        blocks++;
                        Assert.IsTrue(catalog.Knows(item.Type), item.Type);
                        var ws = new BlockWorkspace();
                        ws.AddTop(ws.FromTemplate(item.Template), 0, 0);
                        var r = core.Convert(ws.ToJson(false));
                        Assert.IsTrue(r.Ok, item.Type + ": " + r.Error);
                    }
                }
                Assert.Greater(blocks, 70);
                var setPosition = catalog.Get("jcreatepp_set_position");
                Assert.IsTrue(setPosition.Previous && setPosition.Next && setPosition.Inline);
                CollectionAssert.AreEqual(new[] { "Number" }, setPosition.Input("X").Check);
                Assert.AreEqual("number", catalog.Get("math_number").Field("NUM").Kind);
                Assert.AreNotEqual("#000000", catalog.Get("math_number").Colour, "Blockly's own blocks take the theme colour");
                Assert.IsTrue(catalog.Get("jcreatepp_on_start").IsEvent);
                Assert.IsTrue(catalog.Get("jcreatepp_future_block").Unknown);
                Assert.IsFalse(core.IsStopped);
            }
        }

        [Test]
        public void SavedFileRoundTripsToTheSameCode()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var ws = BlockWorkspace.FromJson(WithShadows);
                var again = ws.ToJson(true);
                StringAssert.Contains("\"variables\": []", again, "keys the editor does not use are kept");
                StringAssert.Contains("\"shadow\"", again);
                Assert.AreEqual(core.Convert(WithShadows).Code, core.Convert(again).Code);
                Assert.AreEqual(ws.ToJson(false), BlockWorkspace.FromJson(again).ToJson(false));
            }
        }

        [Test]
        public void EditsMakeTheDoorScript()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var catalog = Catalog(core);
                var ws = new BlockWorkspace();
                var ev = ws.FromTemplate(Item(catalog, "jcreatepp_on_interact").Template);
                ws.AddTop(ev, 20, 20);
                var flag = ws.FromTemplate(Item(catalog, "jcreatepp_set_flag").Template);
                flag.Fields["FLAG_NAME"] = "open";
                flag.Fields["OPERATION"] = "toggle";
                ws.ConnectStatement(ev, "DO", flag, catalog, 0, 0);
                var turn = ws.FromTemplate(Item(catalog, "jcreatepp_add_rotation").Template);
                turn.Slot("Y").Shadow.Fields["NUM"] = 90.0;
                ws.ConnectStatement(flag, null, turn, catalog, 0, 0);

                var r = core.Convert(ws.ToJson(false));
                Assert.IsTrue(r.Ok, r.Error);
                CollectionAssert.IsEmpty(r.Errors);
                CollectionAssert.IsEmpty(r.Warnings);
                StringAssert.Contains("$.onInteract(", r.Code);
                Assert.AreEqual(1, r.Variables.Count);
                Assert.AreEqual("open", r.Variables[0].Name);
                StringAssert.Contains("\"MovableItem\"", r.SetupJson);

                // Dropping a block between two: inserted, the rest follows it.
                var save = ws.FromTemplate(Item(catalog, "jcreatepp_save_position").Template);
                ws.ConnectStatement(flag, null, save, catalog, 0, 0);
                Assert.AreSame(save, flag.Next);
                Assert.AreSame(turn, save.Next);

                // Deleting heals the stack; taking a block out takes what is below it.
                ws.DetachHealing(save, catalog);
                Assert.AreSame(turn, flag.Next);
                ws.Detach(flag);
                Assert.IsNull(ev.Slot("DO").Block);
                Assert.AreSame(turn, flag.Next, "the chain stays together");
                ws.AddTop(flag, 200, 0);
                Assert.AreEqual(2, ws.Tops.Count);

                // A chain dropped above a stack at the top level goes on top of it.
                var top = ws.FromTemplate(Item(catalog, "jcreatepp_load_position").Template);
                ws.ConnectAbove(flag, top, 200, -30);
                Assert.AreSame(top, ws.Tops[1]);
                Assert.AreSame(flag, top.Next);
                Assert.IsTrue(core.Convert(ws.ToJson(false)).Ok);
            }
        }

        [Test]
        public void ValuesReplaceAndShadowsComeBack()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var catalog = Catalog(core);
                var ws = new BlockWorkspace();
                var move = ws.FromTemplate(Item(catalog, "jcreatepp_set_position").Template);
                ws.AddTop(move, 0, 0);
                var slot = move.Slot("X");
                Assert.IsNotNull(slot.Shadow);
                var dt = ws.FromTemplate(Item(catalog, "jcreatepp_delta_time").Template);
                Assert.IsNull(ws.ConnectValue(move, "X", dt, 50, 50));
                Assert.AreSame(dt, slot.Shown);
                var other = ws.FromTemplate(Item(catalog, "jcreatepp_delta_time").Template);
                Assert.AreSame(dt, ws.ConnectValue(move, "X", other, 50, 50), "the old block is pushed out");
                Assert.AreEqual(2, ws.Tops.Count);
                ws.Detach(other);
                Assert.AreSame(slot.Shadow, slot.Shown, "the shadow is shown again");

                var copy = ws.Copy(move, false);
                var ids = new HashSet<string>();
                foreach (var b in ws.All()) Assert.IsTrue(ids.Add(b.Id));
                ws.AddTop(copy, 0, 100);
                foreach (var b in ws.All()) ids.Add(b.Id);
                Assert.AreEqual(ws.Count + CountShadows(ws), ids.Count, "a copy gets new ids");
            }
        }

        static int CountShadows(BlockWorkspace ws)
        {
            var n = 0;
            foreach (var b in ws.All())
            {
                if (b.IsShadow) n++;
            }
            return n;
        }

        [Test]
        public void DropsFindWhereBlocklyWouldConnect()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var catalog = Catalog(core);
                var ws = new BlockWorkspace();
                var ev = ws.FromTemplate(Item(catalog, "jcreatepp_on_start").Template);
                ws.AddTop(ev, 0, 0);
                var cond = ws.FromTemplate(Item(catalog, "jcreatepp_if").Template);
                ws.ConnectStatement(ev, "DO", cond, catalog, 0, 0);
                var layout = new BlockLayout(catalog, Measure);
                var lr = layout.Layout(ws.Tops);

                Connection mouth = null, condition = null;
                foreach (var c in lr.Connections)
                {
                    if (c.Kind == ConnectionKind.Statement && c.Owner == cond) mouth = c;
                    if (c.Kind == ConnectionKind.Value && c.Owner == cond) condition = c;
                }
                Assert.IsNotNull(mouth);
                Assert.IsNotNull(condition);
                Assert.Greater(mouth.X, (float)ev.X, "the if is inside the start event's mouth");

                var statement = catalog.Get("jcreatepp_save_position");
                var found = lr.FindTarget(statement, statement, mouth.X + 3, mouth.Y + 2, 30, catalog, 28);
                Assert.IsNotNull(found);
                Assert.AreEqual(ConnectionKind.Statement, found.Kind);
                Assert.AreSame(cond, found.Owner);

                // A true/false value fits the condition; a number does not (Blockly's type check).
                var flag = catalog.Get("jcreatepp_flag");
                var hit = lr.FindTarget(flag, flag, condition.X, condition.Y, 20, catalog, 28);
                Assert.IsNotNull(hit);
                Assert.AreEqual(ConnectionKind.Value, hit.Kind);
                var number = catalog.Get("math_number");
                Assert.IsNull(lr.FindTarget(number, number, condition.X, condition.Y, 20, catalog, 28));
                // An event block connects nowhere.
                var start = catalog.Get("jcreatepp_on_start");
                Assert.IsNull(lr.FindTarget(start, start, mouth.X, mouth.Y, 60, catalog, 28));

                // A click on the if's condition shadow hits the shadow; its owner is the if.
                var shadowHit = lr.HitBlock(condition.X + 2, condition.Y + 2);
                Assert.IsNotNull(shadowHit);
                Assert.IsTrue(shadowHit.Block.IsShadow);
                Assert.AreSame(cond, shadowHit.Block.Parent);
            }
        }

        [Test]
        public void PartsAddAsEditableBlocks()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var catalog = Catalog(core);
                // Next to blocks that do not move the item (a part that moves it would clash with a 位置を〜にする).
                const string Quiet = "{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_interact\",\"id\":\"q\",\"x\":0,\"y\":0," +
                                     "\"inputs\":{\"DO\":{\"block\":{\"type\":\"jcreatepp_set_flag\",\"id\":\"f\",\"fields\":{\"FLAG_NAME\":\"open\",\"OPERATION\":\"toggle\"}}}}}]}}";
                foreach (var part in core.Parts())
                {
                    var added = core.AddPart(Quiet, part.Id, "");
                    Assert.IsTrue(added.Ok, part.Id + ": " + added.Error);
                    var ws = BlockWorkspace.FromJson(added.Json);
                    Assert.Greater(ws.Count, 2, part.Id + ": blocks were added (to a new stack or into the existing event)");
                    foreach (var b in ws.All()) Assert.IsTrue(catalog.Knows(b.Type), part.Id + ": " + b.Type);
                    var r = core.Convert(ws.ToJson(false));
                    Assert.IsTrue(r.Ok, part.Id + ": " + r.Error);
                    Assert.AreEqual(core.Convert(added.Json).Code, r.Code, part.Id);
                }
                Assert.IsFalse(core.IsStopped);
            }
        }

        [Test]
        public void WindowOpensAndClosesCleanly()
        {
            BlockEditorWindow.Open();
            var window = EditorWindow.GetWindow<BlockEditorWindow>();
            window.Close();
            Assert.Pass();
        }

        [Test]
        public void JsonWritesLikeJavaScript()
        {
            Assert.AreEqual("{\"a\":[1,2.5,-3,1e-7,1e+21,true,null],\"b\":\"\\\"\\n\\u0001\"}",
                Json.Write(Json.Parse("{\"a\":[1,2.5,-3,1e-7,1e21,true,null],\"b\":\"\\\"\\n\\u0001\"}")));
            Assert.AreEqual("{}", Json.WritePretty(new JsonObject()));
            Assert.IsNull(Json.TryParse("{\"a\":"));
        }
    }
}
