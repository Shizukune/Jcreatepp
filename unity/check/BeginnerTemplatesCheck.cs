using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Jcreatepp.Editor.Blocks;

// Runs against Unity stubs; generated JSON is then converted by the actual block core in Node.
class BeginnerTemplatesCheck
{
    static void Main(string[] args)
    {
        Directory.CreateDirectory(args[0]);
        var type = typeof(BlockEditorWindow);
        var flags = BindingFlags.Instance | BindingFlags.NonPublic;
        foreach (var name in new[] { "Interact", "Toggle", "Sequence", "Cooldown", "Receive" })
        {
            var window = new BlockEditorWindow();
            var original = new BlockWorkspace();
            var catalog = new BlockCatalog();
            var layout = new BlockLayout(catalog, text => text.Length * 7f);
            type.GetField("catalog", flags).SetValue(window, catalog);
            type.GetField("layout", flags).SetValue(window, layout);
            type.GetField("ws", flags).SetValue(window, original);
            var kind = Enum.Parse(type.GetNestedType("TemplateKind", BindingFlags.NonPublic), name);
            type.GetMethod("EnsureExample", flags).Invoke(window, new object[] { name, kind, true });
            if (!ReferenceEquals(original, type.GetField("ws", flags).GetValue(window))) throw new Exception("preview changed workspace");
            var examples = (Dictionary<string, BlockWorkspace>)type.GetField("examples", flags).GetValue(window);
            File.WriteAllText(Path.Combine(args[0], name + "-preview.json"), examples[name].ToJson(false));
            var target = type.GetMethod("AddTemplate", flags).Invoke(window, new object[] { kind, false });
            type.GetMethod("FillReady", flags).Invoke(window, new object[] { target, kind });
            File.WriteAllText(Path.Combine(args[0], name + "-insert.json"), original.ToJson(false));
        }
        Console.WriteLine("beginner templates: C# preview isolation and 10 workspaces checked");
    }
}
