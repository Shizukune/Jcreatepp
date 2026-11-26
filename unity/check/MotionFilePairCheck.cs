using System;
using System.IO;
using Jcreatepp.Editor.Blocks;

class MotionFilePairCheck
{
    static void Check(bool value, string name) { if (!value) throw new Exception(name); }
    static void Refuses(string js)
    {
        try { MotionFilePair.Save(js, "new JS", "new JSON"); }
        catch (IOException) { return; }
        throw new Exception("expected a failed save");
    }
    static void Main(string[] args)
    {
        var dir = Path.Combine(args[0], Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var js = Path.Combine(dir, "motion.js");
        var json = Path.ChangeExtension(js, ".json");
        MotionFilePair.Save(js, "JS 1", "JSON 1");
        Check(File.ReadAllText(js) == "JS 1" && File.ReadAllText(json) == "JSON 1", "new pair");
        File.WriteAllText(js + ".meta", "GUID must stay");
        MotionFilePair.Save(js, "JS 2", "JSON 2");
        Check(File.ReadAllText(js) == "JS 2" && File.ReadAllText(json) == "JSON 2", "replace pair");
        Check(File.ReadAllText(js + ".meta") == "GUID must stay", "Unity meta preserved");
        using (var locked = new FileStream(js, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) Refuses(js);
        Check(File.ReadAllText(json) == "JSON 2" && File.ReadAllText(js) == "JS 2", "rollback existing pair after locked JS");
        var blocked = Path.Combine(dir, "blocked.js");
        Directory.CreateDirectory(blocked);
        Refuses(blocked);
        Check(!File.Exists(Path.ChangeExtension(blocked, ".json")), "remove new JSON after failure");
        var badJson = Path.Combine(dir, "bad-json.js");
        File.WriteAllText(badJson, "old JS");
        Directory.CreateDirectory(Path.ChangeExtension(badJson, ".json"));
        Refuses(badJson);
        Check(File.ReadAllText(badJson) == "old JS", "JSON failure cannot alter JS");
        Check(Directory.GetFiles(dir, "*.tmp").Length == 0 && Directory.GetFiles(dir, "*.bak").Length == 0, "staging files cleaned");
        try { MotionFilePair.Save(Path.Combine(dir, "invalid.json"), "JS", "JSON"); throw new Exception("extension accepted"); }
        catch (ArgumentException) { }
        Console.WriteLine("paired save: 8 checks passed (including late failure and rollback)");
    }
}
