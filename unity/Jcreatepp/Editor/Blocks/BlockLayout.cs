using System;
using System.Collections.Generic;
using Jcreatepp.Editor.Core;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>A rectangle in canvas units (no UnityEngine here, so layout is checked outside Unity too).</summary>
    public struct Box
    {
        public float X, Y, W, H;

        public Box(float x, float y, float w, float h)
        {
            X = x;
            Y = y;
            W = w;
            H = h;
        }

        public float Right { get { return X + W; } }
        public float Bottom { get { return Y + H; } }

        public bool Contains(float px, float py)
        {
            return px >= X && px < X + W && py >= Y && py < Y + H;
        }
    }

    public enum ConnectionKind
    {
        /// <summary>Under a statement block (its next).</summary>
        Next,
        /// <summary>The start of a statement input (inside a C-shaped mouth).</summary>
        Statement,
        /// <summary>A value input.</summary>
        Value,
        /// <summary>Above a stack at the top level (the dragged chain goes on top of it).</summary>
        Above,
    }

    /// <summary>A place a dragged block can connect to.</summary>
    public sealed class Connection
    {
        public ConnectionKind Kind;
        public BlockNode Owner;
        /// <summary>Input name for Statement / Value; null otherwise.</summary>
        public string Input;
        public float X, Y;
        /// <summary>Types the place accepts (null = anything).</summary>
        public List<string> Check;
        /// <summary>The block there now (a shadow does not count).</summary>
        public BlockNode Occupant;
    }

    public sealed class FieldBox
    {
        public BlockNode Block;
        public FieldShape Field;
        public Box Box;
        /// <summary>What is shown (the value for editable fields).</summary>
        public string Text;
    }

    /// <summary>An empty value input (drawn as a hole).</summary>
    public sealed class SlotBox
    {
        public BlockNode Owner;
        public InputShape Input;
        public Box Box;
    }

    public sealed class BlockBox
    {
        public BlockNode Block;
        public BlockShape Shape;
        /// <summary>Outer extent (nested blocks are inside it).</summary>
        public Box Box;
        /// <summary>The filled parts of the block (rows, the left arm of each mouth); also what a click hits.</summary>
        public readonly List<Box> Body = new List<Box>();
        /// <summary>Inputs of the block nested how deep (0 for blocks in a stack at the top level).</summary>
        public int Depth;

        public bool Hits(float x, float y)
        {
            foreach (var b in Body)
            {
                if (b.Contains(x, y)) return true;
            }
            return false;
        }
    }

    /// <summary>Where everything is: blocks in drawing order (a block before what is inside or under it), fields, holes, connections.</summary>
    public sealed class LayoutResult
    {
        public readonly List<BlockBox> Blocks = new List<BlockBox>();
        public readonly List<FieldBox> Fields = new List<FieldBox>();
        public readonly List<SlotBox> Slots = new List<SlotBox>();
        public readonly List<Connection> Connections = new List<Connection>();
        public readonly Dictionary<BlockNode, BlockBox> ByNode = new Dictionary<BlockNode, BlockBox>();
        public Box Bounds;

        /// <summary>The block drawn on top at this point (deepest), or null.</summary>
        public BlockBox HitBlock(float x, float y)
        {
            for (var i = Blocks.Count - 1; i >= 0; i--)
            {
                if (Blocks[i].Hits(x, y)) return Blocks[i];
            }
            return null;
        }

        public FieldBox HitField(float x, float y)
        {
            for (var i = Fields.Count - 1; i >= 0; i--)
            {
                if (Fields[i].Field.Editable && Fields[i].Box.Contains(x, y)) return Fields[i];
            }
            return null;
        }

        /// <summary>
        /// The nearest place (within <paramref name="radius"/>) a chain can connect to, following Blockly's
        /// type checks. (<paramref name="x"/>, <paramref name="y"/>) is the chain's top-left; <paramref name="chainHeight"/>
        /// its height (for putting it above a stack).
        /// </summary>
        public Connection FindTarget(BlockShape first, BlockShape last, float x, float y, float chainHeight, IBlockShapes shapes, float radius)
        {
            Connection best = null;
            var bestDistance = radius * radius;
            foreach (var c in Connections)
            {
                float px = x, py = y;
                switch (c.Kind)
                {
                    case ConnectionKind.Value:
                        if (!first.Output || !BlockShape.Compatible(first.OutputCheck, c.Check)) continue;
                        break;
                    case ConnectionKind.Next:
                    case ConnectionKind.Statement:
                        if (!first.Previous || !BlockShape.Compatible(first.PreviousCheck, c.Check)) continue;
                        break;
                    case ConnectionKind.Above:
                        if (!last.Next || !BlockShape.Compatible(last.NextCheck, c.Check)) continue;
                        py = y + chainHeight;
                        break;
                }
                var dx = px - c.X;
                var dy = py - c.Y;
                var d = dx * dx + dy * dy;
                if (d < bestDistance)
                {
                    bestDistance = d;
                    best = c;
                }
            }
            return best;
        }
    }

    /// <summary>
    /// Lays blocks out like Blockly does, simplified: fields and inputs go in rows (all on one row when the
    /// block is inline, one row per input otherwise), a statement input makes a C-shaped mouth that holds a
    /// stack, a value input holds its block (or shadow, or an empty hole), next blocks go straight below.
    /// </summary>
    public sealed class BlockLayout
    {
        public const float FieldHeight = 18;
        public const float Pad = 6;
        public const float Gap = 4;
        public const float RowPad = 4;
        public const float MinStatementRow = 30;
        public const float MinValueRow = 24;
        public const float ArmWidth = 16;
        public const float EmptyMouth = 22;
        public const float BarHeight = 12;
        public const float HatHeight = 10;
        public const float EmptySlotWidth = 26;
        public const float MinMouthWidth = 40;

        readonly IBlockShapes shapes;
        readonly Func<string, float> measure;

        sealed class Item
        {
            public FieldShape Field;
            public string Text;
            public InputShape Input;
            public InputSlot Slot;
            public BlockNode Child;
            public float W, H;
        }

        sealed class Row
        {
            public bool Statement;
            public bool Bar;
            public InputShape Input;
            public InputSlot Slot;
            public readonly List<Item> Items = new List<Item>();
            public float W, H, Column;
            public float StackW, StackH;
        }

        sealed class Measured
        {
            public BlockShape Shape;
            public readonly List<Row> Rows = new List<Row>();
            public float W, H;
            public bool Hat;
        }

        readonly Dictionary<BlockNode, Measured> measured = new Dictionary<BlockNode, Measured>();

        /// <param name="measure">Width of a text in canvas units (the window uses its label style).</param>
        public BlockLayout(IBlockShapes shapes, Func<string, float> measure)
        {
            this.shapes = shapes;
            this.measure = measure;
        }

        /// <summary>The shown text of a field on a block: its value (dropdowns show the choice's text), or the label.</summary>
        public static string FieldText(BlockNode b, FieldShape f)
        {
            if (f.Name == "" || f.Kind == "label") return f.Text;
            var v = b.Fields.Has(f.Name) ? b.Fields[f.Name] : f.Value;
            if (f.Kind == "dropdown")
            {
                var s = v as string ?? "";
                foreach (var o in f.Options)
                {
                    if (o[1] == s) return o[0];
                }
                return s;
            }
            if (f.Kind == "other" && v == null) return f.Text;
            if (v is double) return Json.Number((double)v);
            if (v is bool) return (bool)v ? "TRUE" : "FALSE";
            return v == null ? "" : v.ToString();
        }

        float FieldWidth(FieldShape f, string text)
        {
            switch (f.Kind)
            {
                case "text":
                case "number":
                    return Math.Max(measure(text) + 12, 30);
                case "dropdown":
                    return measure(text) + 22;
                case "checkbox":
                    return 18;
                case "label":
                    return measure(text);
                default:
                    return measure(text) + 8;
            }
        }

        /// <summary>The size of a block (with what is inside it, without its next blocks).</summary>
        public Box SizeOf(BlockNode b)
        {
            var m = Measure(b);
            return new Box(0, 0, m.W, m.H);
        }

        /// <summary>The size of a chain: a block and everything below it.</summary>
        public Box SizeOfChain(BlockNode b)
        {
            float w = 0, h = 0;
            for (var x = b; x != null; x = x.Next)
            {
                var m = Measure(x);
                w = Math.Max(w, m.W);
                h += m.H;
            }
            return new Box(0, 0, w, h);
        }

        Measured Measure(BlockNode b)
        {
            Measured m;
            if (measured.TryGetValue(b, out m)) return m;
            m = new Measured { Shape = shapes.Get(b.Type) };
            var s = m.Shape;
            m.Hat = s.IsEvent;
            var used = new HashSet<string>();
            var row = new Row();
            foreach (var input in s.Inputs)
            {
                if (!input.Visible) continue;
                if (input.Kind == "statement")
                {
                    if (row.Items.Count > 0) m.Rows.Add(row);
                    row = new Row();
                    var st = new Row { Statement = true, Input = input, Slot = b.Slot(input.Name) };
                    AddFields(st, b, input);
                    m.Rows.Add(st);
                    used.Add(input.Name);
                    continue;
                }
                AddFields(row, b, input);
                if (input.Kind == "value")
                {
                    var slot = b.Slot(input.Name);
                    row.Items.Add(new Item { Input = input, Slot = slot, Child = slot == null ? null : slot.Shown });
                    used.Add(input.Name);
                }
                if (input.Kind == "endrow" || !s.Inline)
                {
                    if (row.Items.Count > 0) m.Rows.Add(row);
                    row = new Row();
                }
            }
            if (row.Items.Count > 0) m.Rows.Add(row);
            // Inputs in the file that the shape does not have (an unknown block, or a changed one): still shown, so nothing is hidden.
            foreach (var slot in b.Inputs)
            {
                if (used.Contains(slot.Name) || slot.Shown == null) continue;
                var shown = slot.Shown;
                if (shapes.Get(shown.Type).Output)
                {
                    var r = new Row();
                    r.Items.Add(new Item { Text = slot.Name, Field = new FieldShape { Text = slot.Name } });
                    r.Items.Add(new Item { Input = new InputShape { Kind = "value", Name = slot.Name }, Slot = slot, Child = shown });
                    m.Rows.Add(r);
                }
                else
                {
                    var st = new Row { Statement = true, Input = new InputShape { Kind = "statement", Name = slot.Name }, Slot = slot };
                    st.Items.Add(new Item { Text = slot.Name, Field = new FieldShape { Text = slot.Name } });
                    m.Rows.Add(st);
                }
            }
            if (m.Rows.Count == 0) m.Rows.Add(new Row());

            // Sizes.
            var minRow = s.Output ? MinValueRow : MinStatementRow;
            float width = 0;
            foreach (var r in m.Rows)
            {
                float itemsW = 0, itemsH = FieldHeight;
                for (var i = 0; i < r.Items.Count; i++)
                {
                    var it = r.Items[i];
                    if (it.Field != null)
                    {
                        it.W = FieldWidth(it.Field, it.Text);
                        it.H = FieldHeight;
                    }
                    else if (it.Child != null)
                    {
                        var cm = Measure(it.Child);
                        it.W = cm.W;
                        it.H = cm.H;
                    }
                    else
                    {
                        it.W = EmptySlotWidth;
                        it.H = FieldHeight;
                    }
                    itemsW += it.W + (i > 0 ? Gap : 0);
                    itemsH = Math.Max(itemsH, it.H);
                }
                if (r.Statement)
                {
                    r.Column = r.Items.Count > 0 ? Math.Max(ArmWidth, Pad + itemsW + Pad) : ArmWidth;
                    var stack = r.Slot == null ? null : r.Slot.Block;
                    if (stack != null)
                    {
                        var size = SizeOfChain(stack);
                        r.StackW = size.W;
                        r.StackH = size.H;
                    }
                    r.H = Math.Max(Math.Max(r.StackH, EmptyMouth), itemsH + 2 * RowPad);
                    r.W = r.Column + MinMouthWidth;
                }
                else
                {
                    r.W = Pad + itemsW + Pad;
                    r.H = Math.Max(minRow, itemsH + 2 * RowPad);
                }
                width = Math.Max(width, r.W);
            }
            // A bar closes each mouth (between two mouths, and at the bottom).
            for (var i = 0; i < m.Rows.Count; i++)
            {
                if (!m.Rows[i].Statement) continue;
                if (i + 1 == m.Rows.Count || m.Rows[i + 1].Statement)
                {
                    m.Rows.Insert(i + 1, new Row { Bar = true, H = BarHeight });
                    i++;
                }
            }
            m.W = Math.Max(width, s.Output ? 20 : 40);
            if (m.Hat) m.W = Math.Max(m.W, 80);
            float height = m.Hat ? HatHeight : 0;
            foreach (var r in m.Rows) height += r.H;
            m.H = height;
            measured[b] = m;
            return m;
        }

        void AddFields(Row row, BlockNode b, InputShape input)
        {
            foreach (var f in input.Fields)
            {
                row.Items.Add(new Item { Field = f, Text = FieldText(b, f) });
            }
        }

        /// <summary>Lays out stacks at their own positions (X, Y of each top block).</summary>
        public LayoutResult Layout(IEnumerable<BlockNode> tops)
        {
            measured.Clear();
            var result = new LayoutResult();
            var first = true;
            foreach (var t in tops)
            {
                PlaceChain(result, t, (float)t.X, (float)t.Y, 0);
                var s = shapes.Get(t.Type);
                if (s.Previous) result.Connections.Add(new Connection { Kind = ConnectionKind.Above, Owner = t, X = (float)t.X, Y = (float)t.Y, Check = s.PreviousCheck });
                var size = SizeOfChain(t);
                var box = new Box((float)t.X, (float)t.Y, size.W, size.H);
                result.Bounds = first ? box : Union(result.Bounds, box);
                first = false;
            }
            return result;
        }

        /// <summary>Lays out one chain at a given place (the palette and the dragged blocks); no connections.</summary>
        public LayoutResult LayoutAt(BlockNode chain, float x, float y)
        {
            measured.Clear();
            var result = new LayoutResult();
            PlaceChain(result, chain, x, y, 0);
            result.Connections.Clear();
            var size = SizeOfChain(chain);
            result.Bounds = new Box(x, y, size.W, size.H);
            return result;
        }

        static Box Union(Box a, Box b)
        {
            var x = Math.Min(a.X, b.X);
            var y = Math.Min(a.Y, b.Y);
            return new Box(x, y, Math.Max(a.Right, b.Right) - x, Math.Max(a.Bottom, b.Bottom) - y);
        }

        void PlaceChain(LayoutResult result, BlockNode b, float x, float y, int depth)
        {
            for (; b != null; b = b.Next)
            {
                var m = Place(result, b, x, y, depth);
                y += m.H;
            }
        }

        Measured Place(LayoutResult result, BlockNode b, float x, float y, int depth)
        {
            var m = Measure(b);
            var s = m.Shape;
            var bb = new BlockBox { Block = b, Shape = s, Box = new Box(x, y, m.W, m.H), Depth = depth };
            result.Blocks.Add(bb);
            result.ByNode[b] = bb;
            var cy = y;
            if (m.Hat)
            {
                bb.Body.Add(new Box(x, y, m.W, HatHeight));
                cy += HatHeight;
            }
            foreach (var r in m.Rows)
            {
                if (r.Bar)
                {
                    bb.Body.Add(new Box(x, cy, m.W, r.H));
                }
                else if (r.Statement)
                {
                    bb.Body.Add(new Box(x, cy, r.Column, r.H));
                    PlaceItems(result, b, r, x + Pad, cy, RowPad, depth);
                    var stack = r.Slot == null ? null : r.Slot.Block;
                    result.Connections.Add(new Connection
                    {
                        Kind = ConnectionKind.Statement, Owner = b, Input = r.Input.Name, X = x + r.Column, Y = cy, Check = r.Input.Check, Occupant = stack,
                    });
                    if (stack != null) PlaceChain(result, stack, x + r.Column, cy, depth + 1);
                }
                else
                {
                    bb.Body.Add(new Box(x, cy, m.W, r.H));
                    PlaceItems(result, b, r, x + Pad, cy, -1, depth);
                }
                cy += r.H;
            }
            if (s.Next) result.Connections.Add(new Connection { Kind = ConnectionKind.Next, Owner = b, X = x, Y = y + m.H, Check = s.NextCheck, Occupant = b.Next });
            return m;
        }

        /// <summary>Places a row's fields and value inputs left to right; <paramref name="top"/> &lt; 0 centres them in the row.</summary>
        void PlaceItems(LayoutResult result, BlockNode b, Row r, float x, float y, float top, int depth)
        {
            foreach (var it in r.Items)
            {
                var iy = top < 0 ? y + (r.H - it.H) / 2 : y + top;
                if (it.Field != null)
                {
                    result.Fields.Add(new FieldBox { Block = b, Field = it.Field, Box = new Box(x, iy, it.W, it.H), Text = it.Text });
                }
                else
                {
                    result.Connections.Add(new Connection
                    {
                        Kind = ConnectionKind.Value, Owner = b, Input = it.Input.Name, X = x, Y = iy, Check = it.Input.Check,
                        Occupant = it.Slot == null ? null : it.Slot.Block,
                    });
                    if (it.Child != null) Place(result, it.Child, x, iy, depth + 1);
                    else result.Slots.Add(new SlotBox { Owner = b, Input = it.Input, Box = new Box(x, iy, it.W, it.H) });
                }
                x += it.W + Gap;
            }
        }
    }
}
