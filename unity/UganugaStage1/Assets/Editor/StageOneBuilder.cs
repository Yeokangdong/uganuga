using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Uganuga.UnityStageOne.Editor
{
    public static class StageOneBuilder
    {
        public const string ScenePath = "Assets/Scenes/JungleStage1.unity";

        [MenuItem("Uganuga/Create or open Jungle Stage 1")]
        public static void CreateScene()
        {
            if (File.Exists(ScenePath)) { EditorSceneManager.OpenScene(ScenePath); return; }
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Uganuga Stage 1").AddComponent<StageOne>();
            Directory.CreateDirectory("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
        }

        [MenuItem("Uganuga/Build Windows preview")]
        public static void BuildWindows()
        {
            CreateScene();
            PlayerSettings.companyName = "Uganuga";
            PlayerSettings.productName = "Uganuga - Jungle Stage 1";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.runInBackground = true;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
            var output = "Builds/Windows/UganugaStage1.exe";
            foreach (var arg in Environment.GetCommandLineArgs())
                if (arg.StartsWith("--buildOutput=")) output = arg.Substring("--buildOutput=".Length);
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { ScenePath }, locationPathName = output,
                target = BuildTarget.StandaloneWindows64, options = BuildOptions.Development
            });
            Debug.Log("UGANUGA_BUILD " + report.summary.result + " bytes=" + report.summary.totalSize);
            if (report.summary.result != BuildResult.Succeeded)
                throw new Exception("Stage 1 Windows build failed: " + report.summary.result);
        }

        public static void ValidateProject()
        {
            CreateScene();
            var library = new StageArt();
            library.Load();
            foreach (var key in new[] { "uga.idle", "uga.walk", "uga.attack", "uga.jump", "uga.climb", "snake.idle", "monkey.idle", "fruit", "meat", "background1", "branch", "vine", "goal" })
                if (!library.Has(key)) throw new Exception("Required artwork missing: " + key);
            Debug.Log("UGANUGA_PROJECT_VALIDATED required artwork, scene and C# compilation passed");
        }
    }
}
