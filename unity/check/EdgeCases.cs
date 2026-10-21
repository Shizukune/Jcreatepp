// Edge cases for ScriptAnalysis: API names inside strings or comments are not calls; IDs are still read.
using System;
using Jcreatepp.Editor;

static class EdgeCases
{
    static int failures;

    static void Expect(bool ok, string what)
    {
        Console.WriteLine((ok ? "ok   " : "FAIL ") + what);
        if (!ok) failures++;
    }

    static int Main()
    {
        var a = ScriptAnalysis.Analyze(
            "// 位置を $.setPosition( で変える（コメント）\n" +
            "$.onInteract(() => {\n" +
            "  $.state[\"str.memo\"] = \"$.onGrab( と $.audio(\\\"fake\\\") は文字\"; // $.onRide(\n" +
            "  $.audio(\"se\").play();\n" +
            "  $.subNode(\"La\\\"bel\").setText(\"x\");\n" +
            "  const t = $.worldItemReference(\"receiver\");\n" +
            "});\n");
        Expect(a.UsesInteract, "onInteract is found");
        Expect(!a.UsesGrab, "onGrab inside a string is not a call");
        Expect(!a.UsesRide, "onRide inside a comment is not a call");
        Expect(!a.MovesByScript, "setPosition inside a comment is not a call");
        Expect(a.AudioIds.Count == 1 && a.AudioIds[0] == "se", "audio id se (not the one inside the string)");
        Expect(a.SubNodes.Count == 1 && a.SubNodes[0] == "La\"bel", "sub node with an escaped quote");
        Expect(a.WorldItemReferenceIds.Count == 1 && a.WorldItemReferenceIds[0] == "receiver", "world item reference");
        return failures == 0 ? 0 : 1;
    }
}
