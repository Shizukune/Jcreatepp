// Runs ScriptAnalysis over the real-device kit scripts and prints what it found (one line per script).
using System;
using System.IO;
using Jcreatepp.Editor;

static class AnalyzeKit
{
    static void Main(string[] args)
    {
        foreach (var path in Directory.GetFiles(args[0], "*.js"))
        {
            var a = ScriptAnalysis.Analyze(File.ReadAllText(path));
            Console.WriteLine(string.Format("{0,-30} move={1} force={2} interact={3} grab={4} ride={5} collide={6} movable={7} physics={8} audio=[{9}] ref=[{10}] sub=[{11}] bytes={12}",
                Path.GetFileName(path), a.MovesByScript ? 1 : 0, a.UsesForce ? 1 : 0, a.UsesInteract ? 1 : 0, a.UsesGrab ? 1 : 0, a.UsesRide ? 1 : 0, a.UsesCollide ? 1 : 0,
                a.NeedsMovable ? 1 : 0, a.PhysicsDriven ? 1 : 0,
                string.Join(",", a.AudioIds.ToArray()), string.Join(",", a.WorldItemReferenceIds.ToArray()), string.Join(",", a.SubNodes.ToArray()), a.Bytes));
        }
    }
}
