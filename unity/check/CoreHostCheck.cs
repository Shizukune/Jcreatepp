// Runs CoreHost.cs (unchanged) on the real Jint (.NET Framework build) outside Unity: every case gives
// exactly what the core gives in Node (unity/check/expected-core.js), parts add the same way, and a
// core that broke inside stops and can be replaced. Prints the times for comparison with Unity.
// Usage: CoreHostCheck.exe <jcreatepp-core.txt> <cases dir>
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Jcreatepp.Editor.Core;

static class CoreHostCheck
{
    static int failures;

    static void Expect(bool ok, string what)
    {
        Console.WriteLine((ok ? "ok   " : "FAIL ") + what);
        if (!ok) failures++;
    }

    /// <summary>Same text as describe() in expected-core.js.</summary>
    static string Describe(CoreHost.ConvertResult r)
    {
        var lines = new List<string>();
        lines.Add("ok=" + (r.Ok ? "true" : "false"));
        lines.Add("error=" + r.Error);
        lines.Add("errors=" + r.Errors.Count);
        lines.AddRange(r.Errors);
        lines.Add("warnings=" + r.Warnings.Count);
        foreach (var w in r.Warnings) lines.Add(string.Join("|", new[] { w.BlockId, w.BlockType, w.EventId, w.EventType, w.EventMessage, w.Text }));
        lines.Add("size=" + r.SizeBytes + "|" + (r.OverCraftItemLimit ? "true" : "false") + "|" + r.SizeText);
        lines.Add("variables=" + r.Variables.Count);
        foreach (var v in r.Variables) lines.Add(v.Kind + "|" + v.Name + "|" + v.StateKey);
        lines.Add("setup=" + r.SetupJson);
        lines.Add("code=");
        lines.Add(r.Code);
        return string.Join("\n", lines.ToArray());
    }

    static string FirstDifference(string want, string got)
    {
        var a = want.Split('\n');
        var b = got.Split('\n');
        for (var i = 0; i < Math.Max(a.Length, b.Length); i++)
        {
            var x = i < a.Length ? a[i] : "(none)";
            var y = i < b.Length ? b[i] : "(none)";
            if (x != y) return "line " + (i + 1) + ": want [" + x + "] got [" + y + "]";
        }
        return "";
    }

    static int Main(string[] args)
    {
        var bundle = File.ReadAllText(args[0]);
        var dir = args[1];
        var read = new Func<string, string>(name => File.ReadAllText(Path.Combine(dir, name)).Replace("\r\n", "\n"));

        using (var host = new CoreHost(bundle))
        {
            Console.WriteLine("time: load " + host.LoadMilliseconds.ToString("0") + " ms");

            // 1. Version.
            var v = host.Version();
            var version = v.Format + " " + v.Jcreatepp + " " + v.Blockly + " " + v.BlockTypes.Count;
            Expect(version == read("version.expected.txt").Trim(), "version: " + version);

            // 2. Every case converts exactly like Node.
            var times = new List<double>();
            foreach (var input in Directory.GetFiles(dir, "*.input.json").OrderBy(f => f, StringComparer.Ordinal))
            {
                var name = Path.GetFileName(input).Replace(".input.json", "");
                if (name == "empty") continue;
                var r = host.Convert(File.ReadAllText(input));
                times.Add(host.LastCallMilliseconds);
                var want = read(name + ".expected.txt");
                var got = Describe(r);
                Expect(got == want, name + " (" + host.LastCallMilliseconds.ToString("0") + " ms)" + (got == want ? "" : " " + FirstDifference(want, got)));
                if (host.IsStopped) { Expect(false, "host stopped: " + host.StopReason); return 1; }
            }
            Console.WriteLine("time: first convert " + times[0].ToString("0") + " ms, then average " + times.Skip(1).Average().ToString("0.0") + " ms over " + (times.Count - 1));

            // 3. Parts: same result as Node on an empty workspace and on the door.
            var parts = host.Parts();
            Expect(parts.Count > 0 && parts.All(p => p.Params.Count > 0), "parts: " + string.Join(", ", parts.Select(p => p.Id).ToArray()));
            var bases = new Dictionary<string, string> { { "empty", read("empty.input.json") }, { "door", read("kit-rd10-door.input.json") } };
            var partLines = new List<string>();
            foreach (var p in parts)
            {
                foreach (var b in new[] { "empty", "door" })
                {
                    var r = host.AddPart(bases[b], p.Id, "");
                    var errors = r.Ok ? string.Join(" / ", host.Convert(r.Json).Errors.ToArray()) : "";
                    partLines.Add(string.Join("\t", new[] { p.Id, b, r.Ok ? "true" : "false", errors, r.Error }));
                }
            }
            var wantParts = read("parts.expected.txt").TrimEnd('\n');
            var gotParts = string.Join("\n", partLines.ToArray());
            Expect(gotParts == wantParts, "parts add like Node" + (gotParts == wantParts ? "" : " " + FirstDifference(wantParts, gotParts)));

            // 4. Values are clamped like the form.
            var spin = host.AddPart(bases["empty"], "spin", "{\"speed\": 99999, \"axis\": \"W\"}");
            var speed = parts.First(p => p.Id == "spin").Params.First(q => q.Key == "speed");
            Expect(spin.Ok && spin.Json.Contains("\"NUM\":" + speed.Max), "part values are clamped (speed " + speed.Max + ")");

            // 5. Shadow blocks (most files saved from the Web palette have them) and the block editor's palette.
            var shadow = host.Convert("{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_interact\",\"inputs\":{\"DO\":{\"block\":{\"type\":\"jcreatepp_add_position\",\"inputs\":{" +
                "\"X\":{\"shadow\":{\"type\":\"math_number\",\"fields\":{\"NUM\":0}}},\"Y\":{\"shadow\":{\"type\":\"math_number\",\"fields\":{\"NUM\":1}}},\"Z\":{\"shadow\":{\"type\":\"math_number\",\"fields\":{\"NUM\":0}}}}}}}}]}}");
            Expect(shadow.Ok && shadow.Errors.Count == 0 && shadow.Code.Contains("new Vector3(0, 1, 0)"), "shadow blocks convert" + (shadow.Ok ? "" : ": " + shadow.Error));
            Expect(host.EditorUnavailableReason == "", "block editor calls available" + (host.EditorUnavailableReason == "" ? "" : ": " + host.EditorUnavailableReason));
            if (args.Length > 2)
            {
                var palette = host.Palette(File.ReadAllText(args[2]));
                Expect(palette.Ok && palette.Json.Length > 0, "palette loads (" + host.LastCallMilliseconds.ToString("0") + " ms)" + (palette.Ok ? "" : ": " + palette.Error));
            }
        }

        // 6. Blockly throwing inside: the host stops; a new host works.
        using (var host = new CoreHost(bundle))
        {
            var bad = "{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_start\",\"inputs\":{\"NOPE\":{\"block\":{\"type\":\"math_number\"}}}}]}}";
            var r = host.Convert(bad);
            Expect(!r.Ok && host.IsStopped && r.Error.Contains("開き直して"), "a core broken inside stops: " + r.Error);
            Expect(!host.Convert("{}").Ok, "a stopped host refuses calls");
        }
        using (var host = new CoreHost(bundle))
        {
            Expect(host.Convert("{}").Ok, "a new host works");
        }

        Console.WriteLine(failures == 0 ? "all ok" : failures + " failed");
        return failures == 0 ? 0 : 1;
    }
}
