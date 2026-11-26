using System;
using System.IO;
using System.Text;

namespace Jcreatepp.Editor.Blocks
{
    /// <summary>Stages both files before publishing. Restores JSON if publishing JS fails.
    /// File.Replace keeps existing Unity .meta files and provides an on-disk rollback copy.</summary>
    public static class MotionFilePair
    {
        public static void Save(string jsPath, string code, string json)
        {
            if (!string.Equals(Path.GetExtension(jsPath), ".js", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("保存先は .js にしてください。", "jsPath");
            var jsonPath = Path.ChangeExtension(jsPath, ".json");
            var suffix = ".jcreatepp-" + Guid.NewGuid().ToString("N");
            var jsStage = jsPath + suffix + ".tmp";
            var jsonStage = jsonPath + suffix + ".tmp";
            var jsBackup = jsPath + suffix + ".bak";
            var jsonBackup = jsonPath + suffix + ".bak";
            var jsonExisted = File.Exists(jsonPath);
            var jsonPublished = false;
            var keepBackup = false;
            try
            {
                File.WriteAllText(jsStage, code, new UTF8Encoding(false));
                File.WriteAllText(jsonStage, json, new UTF8Encoding(false));
                Publish(jsonStage, jsonPath, jsonBackup);
                jsonPublished = true;
                Publish(jsStage, jsPath, jsBackup);
            }
            catch (Exception failure)
            {
                if (jsonPublished)
                {
                    try
                    {
                        if (jsonExisted) File.Replace(jsonBackup, jsonPath, null);
                        else File.Delete(jsonPath);
                    }
                    catch (Exception rollback)
                    {
                        keepBackup = true;
                        throw new IOException("保存と復元に失敗しました。元の JSON の退避先: " + jsonBackup,
                            new AggregateException(failure, rollback));
                    }
                }
                throw;
            }
            finally
            {
                Cleanup(jsStage); Cleanup(jsonStage);
                if (!keepBackup) { Cleanup(jsBackup); Cleanup(jsonBackup); }
            }
        }

        static void Publish(string staged, string destination, string backup)
        {
            if (File.Exists(destination)) File.Replace(staged, destination, backup);
            else File.Move(staged, destination);
        }

        static void Cleanup(string path)
        {
            try { File.Delete(path); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }
}
