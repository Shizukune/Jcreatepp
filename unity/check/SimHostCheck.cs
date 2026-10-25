// Runs SimHost.cs (unchanged) on the real Jint (.NET Framework build) outside Unity:
// the kit scripts give the same result as in Node, and stops / errors behave as designed.
// Usage: SimHostCheck.exe <jcreatepp-sim.txt> <kit scripts dir> <expected.txt>
using System;
using System.Globalization;
using System.IO;
using Jcreatepp.Editor.Preview;

static class SimHostCheck
{
    static int failures;

    static void Expect(bool ok, string what)
    {
        Console.WriteLine((ok ? "ok   " : "FAIL ") + what);
        if (!ok) failures++;
    }

    static readonly double[] Origin = { 0, 0, 0 };
    static readonly double[] NoTurn = { 0, 0, 0, 1 };

    static int Main(string[] args)
    {
        var bundle = File.ReadAllText(args[0]);
        var scripts = args[1];

        // 1. Kit scripts: same operations as unity/check/expected.js, same result.
        foreach (var line in File.ReadAllLines(args[2]))
        {
            if (line.Trim() == "") continue;
            var parts = line.Split(' ');
            using (var host = new SimHost(bundle))
            {
                var error = host.Load(File.ReadAllText(Path.Combine(scripts, parts[0])), Origin, NoTurn);
                if (error != "") { Expect(false, parts[0] + ": " + error); continue; }
                for (var i = 0; i < 30; i++) host.Step(1.0 / 60);
                host.Fire("interact", "", "");
                host.Fire("receive", "open", "");
                for (var i = 0; i < 90; i++) host.Step(1.0 / 60);
                var s = host.TakeSnapshot();
                var got = new[] { s.Position[0], s.Position[1], s.Position[2], s.Rotation[0], s.Rotation[1], s.Rotation[2], s.Rotation[3], s.Time };
                var same = true;
                for (var i = 0; i < got.Length; i++)
                {
                    var want = double.Parse(parts[i + 1], CultureInfo.InvariantCulture);
                    if (Math.Abs(want - got[i]) > 1e-9) same = false;
                }
                Expect(same, parts[0] + " matches Node" + (s.LastError != "" ? " (error: " + s.LastError + ")" : ""));
            }
        }

        // 2. Start pose, events, state rows, log stamps.
        using (var host = new SimHost(bundle))
        {
            host.Load(File.ReadAllText(Path.Combine(scripts, "rd13-grab.js")), new double[] { 1, 2, 3 }, new double[] { 0, Math.Sqrt(0.5), 0, Math.Sqrt(0.5) });
            var s = host.TakeSnapshot();
            Expect(s.Position[0] == 1 && s.Position[1] == 2 && s.Position[2] == 3, "starts at the given position");
            Expect(string.Join(",", s.Events.ToArray()) == "grab,release", "events from handlers: grab, release");
            host.Fire("grab", "", "");
            host.Step(1.0 / 60);
            host.Fire("release", "", "");
            s = host.TakeSnapshot();
            Expect(s.Log.Count == 2 && s.Log[0].Text.Contains("持った") && s.Log[1].Time > 0, "log lines with their own time");
            Expect(host.TakeSnapshot().Log.Count == 0, "log lines are returned once");
        }

        // 3. Receive value conversion and state rows.
        using (var host = new SimHost(bundle))
        {
            host.Load("$.onReceive((m, v) => { $.state[\"str.got\"] = typeof v + \":\" + String(v); $.state[\"bool.on\"] = true; });", Origin, NoTurn);
            host.Fire("receive", "x", "001");
            var s = host.TakeSnapshot();
            var text = "";
            foreach (var r in s.State) text += r.Kind + "=" + r.Text + ";";
            Expect(text == "string=\"number:1\";bool=ON;" || text == "bool=ON;string=\"number:1\";", "state rows: " + text);
        }

        // 4. Errors.
        using (var host = new SimHost(bundle))
        {
            var error = host.Load("$.onStart(() => {", Origin, NoTurn);
            Expect(error.Contains("スクリプトを実行できません"), "syntax error is reported: " + error);
            Expect(host.TakeSnapshot() == null && !host.IsStopped, "no snapshot after a failed load; host still usable");
            error = host.Load("$.onStart(() => { null.x; });", Origin, NoTurn);
            Expect(error == "" && host.TakeSnapshot().LastError.Contains("start"), "error in onStart is kept as LastError");
        }

        // 5. A script that never ends: the call stops within the time limit, the host is stopped.
        using (var host = new SimHost(bundle))
        {
            host.Load("$.onUpdate(() => { while (true) {} });", Origin, NoTurn);
            var started = DateTime.UtcNow;
            host.Step(1.0 / 60);
            var took = DateTime.UtcNow - started;
            Expect(host.IsStopped && took < SimHost.CallTimeout + TimeSpan.FromSeconds(1), "endless loop in a frame stops (" + took.TotalSeconds.ToString("0.00") + " s): " + host.StopReason);
            Expect(host.TakeSnapshot() == null, "a stopped host returns no snapshot");
        }

        // 5b. A load that never ends stops within the (longer) setup limit.
        using (var host = new SimHost(bundle))
        {
            var started = DateTime.UtcNow;
            var error = host.Load("while (true) {}", Origin, NoTurn);
            var took = DateTime.UtcNow - started;
            Expect(host.IsStopped && took >= SimHost.CallTimeout && took < SimHost.SetupTimeout + TimeSpan.FromSeconds(1), "endless loop at load stops after the setup limit (" + took.TotalSeconds.ToString("0.00") + " s): " + error);
        }

        // 6. Too deep recursion.
        using (var host = new SimHost(bundle))
        {
            host.Load("function f(n) { return f(n + 1); } $.onInteract(() => { f(0); });", Origin, NoTurn);
            host.Fire("interact", "", "");
            var s = host.TakeSnapshot();
            Expect(host.IsStopped || (s != null && s.LastError != ""), "deep recursion is stopped or reported: " + (host.IsStopped ? host.StopReason : s.LastError));
        }

        // 7. After a stop, a new host works (what 「最初から」 does).
        using (var host = new SimHost(bundle))
        {
            host.Load("$.onInteract(() => { $.state[\"var.n\"] = 7; });", Origin, NoTurn);
            host.Fire("interact", "", "");
            Expect(host.TakeSnapshot().State[0].Text == "7", "a new host runs normally");
        }

        Console.WriteLine(failures == 0 ? "all ok" : failures + " failed");
        return failures == 0 ? 0 : 1;
    }
}
