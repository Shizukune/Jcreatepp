using System.Collections.Generic;
using Jcreatepp.Editor.Core;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>One field of a block as Blockly describes it (label, text, number, dropdown, checkbox, other).</summary>
    public sealed class FieldShape
    {
        public string Name = "";
        public string Kind = "label";
        /// <summary>The label's text, or the field's text for its default value.</summary>
        public string Text = "";
        /// <summary>Default value (double for number, string otherwise); null for labels.</summary>
        public object Value;
        /// <summary>Dropdown choices: [shown text, saved value].</summary>
        public readonly List<string[]> Options = new List<string[]>();
        public double? Min, Max, Precision;

        public bool Editable { get { return Name != "" && (Kind == "text" || Kind == "number" || Kind == "dropdown" || Kind == "checkbox"); } }
    }

    /// <summary>One input of a block: value (a slot for a value block), statement (a C-shaped mouth), dummy / endrow (fields only).</summary>
    public sealed class InputShape
    {
        public string Kind = "dummy";
        public string Name = "";
        /// <summary>Accepted types; null = anything.</summary>
        public List<string> Check;
        public bool Visible = true;
        public readonly List<FieldShape> Fields = new List<FieldShape>();

        public bool HasConnection { get { return Kind == "value" || Kind == "statement"; } }
    }

    /// <summary>The shape of a block type, from the core's Blockly (CoreHost.Shapes).</summary>
    public sealed class BlockShape
    {
        public string Type = "";
        /// <summary>"#rrggbb".</summary>
        public string Colour = "#888888";
        public bool Output, Previous, Next, Inline;
        public List<string> OutputCheck, PreviousCheck, NextCheck;
        public string Tooltip = "";
        public readonly List<InputShape> Inputs = new List<InputShape>();
        /// <summary>True for a type the core does not know (drawn grey; the converter refuses the file).</summary>
        public bool Unknown;

        /// <summary>An event (開始時, インタラクト時, ...): nothing above it and no value out.</summary>
        public bool IsEvent { get { return !Output && !Previous; } }

        public InputShape Input(string name)
        {
            foreach (var i in Inputs)
            {
                if (i.Name == name && i.HasConnection) return i;
            }
            return null;
        }

        public FieldShape Field(string name)
        {
            foreach (var i in Inputs)
            {
                foreach (var f in i.Fields)
                {
                    if (f.Name == name) return f;
                }
            }
            return null;
        }

        public static BlockShape FromJson(JsonObject o)
        {
            var s = new BlockShape
            {
                Type = o.String("type", ""),
                Colour = o.String("colour", "#888888"),
                Output = o.Bool("output", false),
                Previous = o.Bool("previous", false),
                Next = o.Bool("next", false),
                Inline = o.Bool("inline", false),
                OutputCheck = Strings(o.Array("outputCheck")),
                PreviousCheck = Strings(o.Array("previousCheck")),
                NextCheck = Strings(o.Array("nextCheck")),
                Tooltip = o.String("tooltip", ""),
            };
            var inputs = o.Array("inputs");
            if (inputs == null) return s;
            foreach (var x in inputs)
            {
                var io = x as JsonObject;
                if (io == null) continue;
                var input = new InputShape
                {
                    Kind = io.String("kind", "dummy"),
                    Name = io.String("name", ""),
                    Check = Strings(io.Array("check")),
                    Visible = io.Bool("visible", true),
                };
                var fields = io.Array("fields");
                if (fields != null)
                {
                    foreach (var y in fields)
                    {
                        var fo = y as JsonObject;
                        if (fo == null) continue;
                        var f = new FieldShape
                        {
                            Name = fo.String("name", ""),
                            Kind = fo.String("kind", "label"),
                            Text = fo.String("text", ""),
                            Value = fo["value"],
                        };
                        if (fo["min"] is double) f.Min = (double)fo["min"];
                        if (fo["max"] is double) f.Max = (double)fo["max"];
                        if (fo["precision"] is double) f.Precision = (double)fo["precision"];
                        var options = fo.Array("options");
                        if (options != null)
                        {
                            foreach (var z in options)
                            {
                                var pair = z as List<object>;
                                if (pair != null && pair.Count == 2) f.Options.Add(new[] { pair[0] as string ?? "", pair[1] as string ?? "" });
                            }
                        }
                        input.Fields.Add(f);
                    }
                }
                s.Inputs.Add(input);
            }
            return s;
        }

        static List<string> Strings(List<object> a)
        {
            if (a == null) return null;
            var list = new List<string>();
            foreach (var x in a)
            {
                var str = x as string;
                if (str != null) list.Add(str);
            }
            return list;
        }

        /// <summary>A stand-in for a type the core does not know: a grey block that keeps whatever it holds.</summary>
        public static BlockShape ForUnknown(string type)
        {
            var s = new BlockShape { Type = type, Colour = "#808080", Previous = true, Next = true, Unknown = true };
            var label = new InputShape();
            label.Fields.Add(new FieldShape { Text = "不明なブロック: " + type });
            s.Inputs.Add(label);
            return s;
        }

        /// <summary>Blockly's rule: either side without a check takes anything; otherwise they must share a type.</summary>
        public static bool Compatible(List<string> a, List<string> b)
        {
            if (a == null || b == null) return true;
            foreach (var x in a)
            {
                if (b.Contains(x)) return true;
            }
            return false;
        }
    }

    /// <summary>Where the editor gets block shapes from.</summary>
    public interface IBlockShapes
    {
        /// <summary>Never null: an unknown type gets <see cref="BlockShape.ForUnknown"/>.</summary>
        BlockShape Get(string type);
    }

    public sealed class PaletteItem
    {
        /// <summary>"label", "button" or "block".</summary>
        public string Kind = "";
        public string Text = "";
        public string Type = "";
        public string CallbackKey = "";
        /// <summary>The block as Blockly saves it (every field filled in, shadows included); ids are replaced when it is placed.</summary>
        public JsonObject Template;
    }

    public sealed class PaletteCategory
    {
        public string Name = "";
        public string Colour = "#888888";
        public readonly List<PaletteItem> Items = new List<PaletteItem>();
    }

    /// <summary>The palette and block shapes, read once from the core.</summary>
    public sealed class BlockCatalog : IBlockShapes
    {
        /// <summary>Types per shapes call (each call has the core's time limit).</summary>
        const int ShapesPerCall = 12;

        public readonly List<PaletteCategory> Categories = new List<PaletteCategory>();
        readonly Dictionary<string, BlockShape> shapes = new Dictionary<string, BlockShape>();
        readonly Dictionary<string, BlockShape> unknown = new Dictionary<string, BlockShape>();

        public int ShapeCount { get { return shapes.Count; } }

        public BlockShape Get(string type)
        {
            BlockShape s;
            if (shapes.TryGetValue(type ?? "", out s)) return s;
            if (!unknown.TryGetValue(type ?? "", out s))
            {
                s = BlockShape.ForUnknown(type ?? "");
                unknown[type ?? ""] = s;
            }
            return s;
        }

        public bool Knows(string type)
        {
            return shapes.ContainsKey(type ?? "");
        }

        public void Add(BlockShape shape)
        {
            shapes[shape.Type] = shape;
            unknown.Remove(shape.Type);
        }

        /// <summary>Reads the palette and every shape it needs. Null (and why) when the core cannot.</summary>
        public static BlockCatalog Load(CoreHost core, string toolboxJson, out string error)
        {
            error = "";
            var palette = core.Palette(toolboxJson);
            if (!palette.Ok)
            {
                error = palette.Error;
                return null;
            }
            var o = Json.Parse(palette.Json) as JsonObject;
            var catalog = new BlockCatalog();
            var categories = o == null ? null : o.Array("categories");
            if (categories != null)
            {
                foreach (var x in categories)
                {
                    var co = x as JsonObject;
                    if (co == null) continue;
                    var c = new PaletteCategory { Name = co.String("name", ""), Colour = co.String("colour", "#888888") };
                    var items = co.Array("items");
                    if (items != null)
                    {
                        foreach (var y in items)
                        {
                            var io = y as JsonObject;
                            if (io == null) continue;
                            c.Items.Add(new PaletteItem
                            {
                                Kind = io.String("kind", ""),
                                Text = io.String("text", ""),
                                Type = io.String("type", ""),
                                CallbackKey = io.String("callbackKey", ""),
                                Template = io.Object("template"),
                            });
                        }
                    }
                    catalog.Categories.Add(c);
                }
            }
            var types = new List<string>();
            var listed = o == null ? null : o.Array("types");
            if (listed != null)
            {
                foreach (var t in listed)
                {
                    if (t is string) types.Add((string)t);
                }
            }
            if (!catalog.LoadShapes(core, types, out error)) return null;
            return catalog;
        }

        /// <summary>Asks the core for the shapes of these types (known ones are skipped). False (and why) when the core cannot.</summary>
        public bool LoadShapes(CoreHost core, IEnumerable<string> types, out string error)
        {
            error = "";
            var missing = new List<string>();
            foreach (var t in types)
            {
                if (!shapes.ContainsKey(t) && !missing.Contains(t)) missing.Add(t);
            }
            for (var start = 0; start < missing.Count; start += ShapesPerCall)
            {
                var chunk = missing.GetRange(start, System.Math.Min(ShapesPerCall, missing.Count - start));
                var r = core.Shapes(Json.Write(new List<object>(chunk.ConvertAll(t => (object)t))));
                if (!r.Ok)
                {
                    error = r.Error;
                    return false;
                }
                var o = Json.Parse(r.Json) as JsonObject;
                var found = o == null ? null : o.Object("shapes");
                if (found == null) continue;
                foreach (var key in found.Keys)
                {
                    var so = found.Object(key);
                    if (so != null) Add(BlockShape.FromJson(so));
                }
            }
            return true;
        }
    }
}
