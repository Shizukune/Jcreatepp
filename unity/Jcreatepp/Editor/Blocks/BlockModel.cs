using System;
using System.Collections.Generic;
using System.Text;
using Jcreatepp.Editor.Core;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>An input of a placed block: the block plugged in, and the shadow shown when nothing is.</summary>
    public sealed class InputSlot
    {
        public string Name = "";
        public BlockNode Block;
        public BlockNode Shadow;

        /// <summary>What is shown: the plugged block, else the shadow, else null.</summary>
        public BlockNode Shown { get { return Block ?? Shadow; } }
    }

    /// <summary>
    /// One block of a workspace, as in Blockly's saved JSON (serialization.blocks). Keys this editor
    /// does not use (extraState, collapsed, data, ...) are kept as read and written back.
    /// </summary>
    public sealed class BlockNode
    {
        public string Type = "";
        public string Id = "";
        /// <summary>Position on the canvas; only saved for blocks at the top level.</summary>
        public double X, Y;
        public bool IsShadow;
        public readonly JsonObject Fields = new JsonObject();
        public readonly List<InputSlot> Inputs = new List<InputSlot>();
        public BlockNode Next;
        /// <summary>Blockly allows a shadow under next; kept as read.</summary>
        public BlockNode NextShadow;
        public readonly JsonObject Extra = new JsonObject();

        /// <summary>The block this one hangs from (null at the top level). Kept by <see cref="BlockWorkspace.Relink"/>.</summary>
        public BlockNode Parent { get; internal set; }
        /// <summary>The parent's input this block is in; null when it follows the parent through next.</summary>
        public InputSlot ParentInput { get; internal set; }

        public InputSlot Slot(string name)
        {
            foreach (var s in Inputs)
            {
                if (s.Name == name) return s;
            }
            return null;
        }

        public InputSlot SlotOrNew(string name)
        {
            var s = Slot(name);
            if (s != null) return s;
            s = new InputSlot { Name = name };
            Inputs.Add(s);
            return s;
        }

        /// <summary>The last block of the chain that starts here (following next).</summary>
        public BlockNode Last
        {
            get
            {
                var b = this;
                while (b.Next != null) b = b.Next;
                return b;
            }
        }

        /// <summary>The topmost block of the stack this one is in.</summary>
        public BlockNode Root
        {
            get
            {
                var b = this;
                while (b.Parent != null) b = b.Parent;
                return b;
            }
        }

        public IEnumerable<BlockNode> Children()
        {
            foreach (var s in Inputs)
            {
                if (s.Shadow != null) yield return s.Shadow;
                if (s.Block != null) yield return s.Block;
            }
            if (NextShadow != null) yield return NextShadow;
            if (Next != null) yield return Next;
        }
    }

    /// <summary>
    /// A workspace of blocks: what the editor shows and edits, and what is saved (Blockly's own JSON,
    /// so the Web editor opens the file). Edits follow Blockly: a statement block takes the blocks below
    /// it along, a block dropped in the middle of a stack is inserted, and a value dropped on an occupied
    /// input pushes the old one out.
    /// </summary>
    public sealed class BlockWorkspace
    {
        /// <summary>The characters Blockly uses for ids (utils.idGenerator), 20 of them per id.</summary>
        const string IdSoup = "!#$%()*+,-./:;=?@[]^_`{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const int IdLength = 20;
        static readonly Random Random = new Random();

        public readonly List<BlockNode> Tops = new List<BlockNode>();
        /// <summary>Everything in the file besides the blocks (variables, ...), kept as read.</summary>
        readonly JsonObject root = new JsonObject();
        readonly JsonObject blocksSection = new JsonObject();

        public BlockWorkspace()
        {
        }

        /// <summary>Reads a saved workspace. Throws FormatException (with a message for the user) when it is not one.</summary>
        public static BlockWorkspace FromJson(string json)
        {
            var parsed = Json.Parse(json) as JsonObject;
            if (parsed == null) throw new FormatException("ブロックのファイルの形が違います。");
            var ws = new BlockWorkspace();
            foreach (var key in parsed.Keys)
            {
                if (key != "blocks") ws.root[key] = parsed[key];
            }
            var blocks = parsed.Object("blocks");
            if (parsed.Has("blocks") && blocks == null) throw new FormatException("ブロックのファイルの形が違います（blocks）。");
            if (blocks != null)
            {
                foreach (var key in blocks.Keys)
                {
                    if (key != "blocks") ws.blocksSection[key] = blocks[key];
                }
                var list = blocks.Array("blocks");
                if (list == null) throw new FormatException("ブロックのファイルの形が違います（blocks.blocks がありません）。");
                foreach (var x in list)
                {
                    var o = x as JsonObject;
                    if (o == null) throw new FormatException("ブロックのファイルの形が違います（ブロックが壊れています）。");
                    var b = ReadBlock(o, false, 0);
                    b.X = o.Number("x", 0);
                    b.Y = o.Number("y", 0);
                    ws.Tops.Add(b);
                }
            }
            ws.Relink();
            return ws;
        }

        static BlockNode ReadBlock(JsonObject o, bool shadow, int depth)
        {
            if (depth > 400) throw new FormatException("ブロックのつながりが深すぎます。");
            var b = new BlockNode { Type = o.String("type", ""), Id = o.String("id", ""), IsShadow = shadow };
            if (b.Type == "") throw new FormatException("ブロックのファイルの形が違います（種類の無いブロックがあります）。");
            foreach (var key in o.Keys)
            {
                switch (key)
                {
                    case "type":
                    case "id":
                    case "x":
                    case "y":
                        break;
                    case "fields":
                        var fields = o.Object("fields");
                        if (fields != null)
                        {
                            foreach (var f in fields.Keys) b.Fields[f] = fields[f];
                        }
                        break;
                    case "inputs":
                        var inputs = o.Object("inputs");
                        if (inputs == null) break;
                        foreach (var name in inputs.Keys)
                        {
                            var c = inputs.Object(name);
                            if (c == null) continue;
                            var slot = new InputSlot { Name = name };
                            if (c.Object("shadow") != null) slot.Shadow = ReadBlock(c.Object("shadow"), true, depth + 1);
                            if (c.Object("block") != null) slot.Block = ReadBlock(c.Object("block"), false, depth + 1);
                            b.Inputs.Add(slot);
                        }
                        break;
                    case "next":
                        var next = o.Object("next");
                        if (next == null) break;
                        if (next.Object("shadow") != null) b.NextShadow = ReadBlock(next.Object("shadow"), true, depth + 1);
                        if (next.Object("block") != null) b.Next = ReadBlock(next.Object("block"), false, depth + 1);
                        break;
                    default:
                        b.Extra[key] = o[key];
                        break;
                }
            }
            return b;
        }

        /// <summary>The file text: Blockly's save format. <paramref name="pretty"/> indents like the Web editor's file save.</summary>
        public string ToJson(bool pretty)
        {
            var o = new JsonObject();
            if (Tops.Count > 0)
            {
                var blocks = new JsonObject();
                blocks["languageVersion"] = blocksSection.Has("languageVersion") ? blocksSection["languageVersion"] : (object)0.0;
                foreach (var key in blocksSection.Keys)
                {
                    if (key != "languageVersion") blocks[key] = blocksSection[key];
                }
                var list = new List<object>();
                foreach (var b in Tops) list.Add(WriteBlock(b, true));
                blocks["blocks"] = list;
                o["blocks"] = blocks;
            }
            foreach (var key in root.Keys) o[key] = root[key];
            return pretty ? Json.WritePretty(o) : Json.Write(o);
        }

        static JsonObject WriteBlock(BlockNode b, bool top)
        {
            var o = new JsonObject();
            o["type"] = b.Type;
            o["id"] = b.Id;
            if (top)
            {
                // Blockly saves whole pixels.
                o["x"] = Math.Round(b.X);
                o["y"] = Math.Round(b.Y);
            }
            foreach (var key in b.Extra.Keys) o[key] = b.Extra[key];
            if (b.Fields.Count > 0)
            {
                var fields = new JsonObject();
                foreach (var key in b.Fields.Keys) fields[key] = b.Fields[key];
                o["fields"] = fields;
            }
            var inputs = new JsonObject();
            foreach (var s in b.Inputs)
            {
                if (s.Block == null && s.Shadow == null) continue;
                var c = new JsonObject();
                if (s.Shadow != null) c["shadow"] = WriteBlock(s.Shadow, false);
                if (s.Block != null) c["block"] = WriteBlock(s.Block, false);
                inputs[s.Name] = c;
            }
            if (inputs.Count > 0) o["inputs"] = inputs;
            if (b.Next != null || b.NextShadow != null)
            {
                var next = new JsonObject();
                if (b.NextShadow != null) next["shadow"] = WriteBlock(b.NextShadow, false);
                if (b.Next != null) next["block"] = WriteBlock(b.Next, false);
                o["next"] = next;
            }
            return o;
        }

        /// <summary>Sets every block's <see cref="BlockNode.Parent"/> again (after any change).</summary>
        public void Relink()
        {
            foreach (var t in Tops) Link(t, null, null);
        }

        static void Link(BlockNode b, BlockNode parent, InputSlot input)
        {
            // Iterative along next (stacks can be long); recursive into inputs (bounded by the core's depth limit).
            while (b != null)
            {
                b.Parent = parent;
                b.ParentInput = input;
                foreach (var s in b.Inputs)
                {
                    if (s.Shadow != null) Link(s.Shadow, b, s);
                    if (s.Block != null) Link(s.Block, b, s);
                }
                if (b.NextShadow != null) Link(b.NextShadow, b, null);
                parent = b;
                input = null;
                b = b.Next;
            }
        }

        /// <summary>Every block, shadows included, parents before children.</summary>
        public IEnumerable<BlockNode> All()
        {
            var stack = new Stack<BlockNode>();
            for (var i = Tops.Count - 1; i >= 0; i--) stack.Push(Tops[i]);
            while (stack.Count > 0)
            {
                var b = stack.Pop();
                yield return b;
                var children = new List<BlockNode>(b.Children());
                for (var i = children.Count - 1; i >= 0; i--) stack.Push(children[i]);
            }
        }

        public BlockNode Find(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            foreach (var b in All())
            {
                if (b.Id == id) return b;
            }
            return null;
        }

        public int Count
        {
            get
            {
                var n = 0;
                foreach (var b in All())
                {
                    if (!b.IsShadow) n++;
                }
                return n;
            }
        }

        /// <summary>
        /// Takes a block out of where it is, with everything below it (a statement block keeps its next blocks,
        /// as in Blockly). An input it leaves shows its shadow again.
        /// </summary>
        public void Detach(BlockNode b)
        {
            if (b.IsShadow) throw new InvalidOperationException("影のブロックは動かせません。");
            var parent = b.Parent;
            if (parent == null)
            {
                Tops.Remove(b);
            }
            else if (b.ParentInput != null)
            {
                if (b.ParentInput.Block == b) b.ParentInput.Block = null;
            }
            else if (parent.Next == b)
            {
                parent.Next = null;
            }
            b.Parent = null;
            b.ParentInput = null;
        }

        /// <summary>Takes out only this block: the blocks below it close the gap (Blockly's delete).</summary>
        public void DetachHealing(BlockNode b, IBlockShapes shapes)
        {
            var parent = b.Parent;
            var input = b.ParentInput;
            var next = b.Next;
            var x = b.X;
            var y = b.Y;
            Detach(b);
            if (next == null) return;
            b.Next = null;
            if (parent == null)
            {
                next.X = x;
                next.Y = y;
                Tops.Add(next);
            }
            else if (input != null)
            {
                input.Block = next;
            }
            else
            {
                parent.Next = next;
            }
            Relink();
        }

        public void AddTop(BlockNode b, double x, double y)
        {
            b.X = x;
            b.Y = y;
            Tops.Add(b);
            Relink();
        }

        /// <summary>
        /// Puts a chain where another chain continues: after <paramref name="parent"/> (input null) or at the start
        /// of a statement input. What was there goes under the chain's last block, or is pushed out to
        /// (<paramref name="bumpX"/>, <paramref name="bumpY"/>) when that block cannot take a next block.
        /// </summary>
        public void ConnectStatement(BlockNode parent, string input, BlockNode chain, IBlockShapes shapes, double bumpX, double bumpY)
        {
            BlockNode old;
            if (input == null)
            {
                old = parent.Next;
                parent.Next = chain;
            }
            else
            {
                var slot = parent.SlotOrNew(input);
                old = slot.Block;
                slot.Block = chain;
            }
            if (old != null)
            {
                var last = chain.Last;
                var lastShape = shapes.Get(last.Type);
                var oldShape = shapes.Get(old.Type);
                if (lastShape.Next && BlockShape.Compatible(lastShape.NextCheck, oldShape.PreviousCheck)) last.Next = old;
                else
                {
                    old.X = bumpX;
                    old.Y = bumpY;
                    Tops.Add(old);
                }
            }
            Relink();
        }

        /// <summary>Plugs a value block into an input. A block already there is pushed out and returned (null when none).</summary>
        public BlockNode ConnectValue(BlockNode parent, string input, BlockNode block, double bumpX, double bumpY)
        {
            var slot = parent.SlotOrNew(input);
            var old = slot.Block;
            slot.Block = block;
            if (old != null)
            {
                old.X = bumpX;
                old.Y = bumpY;
                Tops.Add(old);
            }
            Relink();
            return old;
        }

        /// <summary>Puts a chain on top of a stack at the top level: the chain takes the stack's place, the stack goes under it.</summary>
        public void ConnectAbove(BlockNode top, BlockNode chain, double x, double y)
        {
            var index = Tops.IndexOf(top);
            if (index < 0) throw new InvalidOperationException("上につなげられるのは、いちばん上のブロックだけです。");
            Tops[index] = chain;
            chain.X = x;
            chain.Y = y;
            chain.Last.Next = top;
            Relink();
        }

        /// <summary>A copy of a block (and what is in its inputs; its next blocks too when <paramref name="withNext"/>) with new ids.</summary>
        public BlockNode Copy(BlockNode b, bool withNext)
        {
            var used = Ids();
            var copy = CopyBlock(b, withNext, used, 0);
            copy.X = b.X;
            copy.Y = b.Y;
            return copy;
        }

        static BlockNode CopyBlock(BlockNode b, bool withNext, HashSet<string> used, int depth)
        {
            var c = new BlockNode { Type = b.Type, Id = NewId(used), IsShadow = b.IsShadow };
            foreach (var key in b.Fields.Keys) c.Fields[key] = Json.Clone(b.Fields[key]);
            foreach (var key in b.Extra.Keys) c.Extra[key] = Json.Clone(b.Extra[key]);
            foreach (var s in b.Inputs)
            {
                c.Inputs.Add(new InputSlot
                {
                    Name = s.Name,
                    Shadow = s.Shadow == null ? null : CopyBlock(s.Shadow, true, used, depth + 1),
                    Block = s.Block == null ? null : CopyBlock(s.Block, true, used, depth + 1),
                });
            }
            if (b.NextShadow != null) c.NextShadow = CopyBlock(b.NextShadow, true, used, depth + 1);
            if (withNext && b.Next != null) c.Next = CopyBlock(b.Next, true, used, depth + 1);
            return c;
        }

        /// <summary>A new block from a palette template (Blockly's saved form), with new ids.</summary>
        public BlockNode FromTemplate(JsonObject template)
        {
            var b = ReadBlock((JsonObject)Json.Clone(template), false, 0);
            var used = Ids();
            var stack = new Stack<BlockNode>();
            stack.Push(b);
            while (stack.Count > 0)
            {
                var x = stack.Pop();
                x.Id = NewId(used);
                foreach (var child in x.Children()) stack.Push(child);
            }
            return b;
        }

        HashSet<string> Ids()
        {
            var used = new HashSet<string>();
            foreach (var b in All()) used.Add(b.Id);
            return used;
        }

        /// <summary>A Blockly-style id not in <paramref name="used"/> (and adds it there).</summary>
        public static string NewId(HashSet<string> used)
        {
            while (true)
            {
                var sb = new StringBuilder(IdLength);
                lock (Random)
                {
                    for (var i = 0; i < IdLength; i++) sb.Append(IdSoup[Random.Next(IdSoup.Length)]);
                }
                var id = sb.ToString();
                if (used == null || used.Add(id)) return id;
            }
        }
    }
}
