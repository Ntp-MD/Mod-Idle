using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using UnityEngine.Rendering.Universal;

var sources = JObject.Parse(File.ReadAllText("../../tools/data/external-vfx.json"))["sources"];
var output = Path.GetFullPath("../unity-baked-vfx");
Directory.CreateDirectory(output);
var originalPipeline = GraphicsSettings.defaultRenderPipeline;
var originalQuality = QualitySettings.renderPipeline;
var originalActive = RenderTexture.active;
var scene = EditorSceneManager.NewPreviewScene();
var cameraObject = new GameObject("VFX bake camera");
SceneManager.MoveGameObjectToScene(cameraObject, scene);
var camera = cameraObject.AddComponent<Camera>();
camera.cameraType = CameraType.Preview;
camera.scene = scene;
camera.renderingPath = RenderingPath.Forward;
camera.orthographic = true;
camera.orthographicSize = 4;
camera.aspect = 1;
var cameraSource = File.ReadAllText(Path.GetFullPath("../../game/src/presentation/arena-camera.ts"));
var elevation = float.Parse(Regex.Match(cameraSource, @"ARENA_CAMERA_ELEVATION_DEG = ([0-9.]+)").Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) * Mathf.Deg2Rad;
camera.transform.position = new Vector3(0, .6f + 10 * Mathf.Sin(elevation), -10 * Mathf.Cos(elevation));
camera.transform.LookAt(new Vector3(0, .6f, 0));
camera.clearFlags = CameraClearFlags.SolidColor;
camera.backgroundColor = Color.clear;
camera.cullingMask = 1 << 30;
camera.nearClipPlane = .01f;
camera.farClipPlane = 50;
camera.enabled = false;
var lightObject = new GameObject("VFX bake key light");
SceneManager.MoveGameObjectToScene(lightObject, scene);
var keyLight = lightObject.AddComponent<Light>();
keyLight.type = LightType.Directional;
keyLight.intensity = 1.4f;
keyLight.transform.rotation = Quaternion.Euler(50, -30, 0);
var target = new RenderTexture(512, 512, 24, RenderTextureFormat.ARGB32);
target.hideFlags = HideFlags.HideAndDontSave;
camera.targetTexture = target;
var frame = new Texture2D(512, 512, TextureFormat.RGBA32, false);
frame.hideFlags = HideFlags.HideAndDontSave;
var results = new List<object>();
var failures = new List<object>();
try {
  foreach (var entry in sources.Children<JProperty>()) {
    var name = entry.Name;
    var spec = entry.Value;
    if (spec["image"] != null) continue;
    GameObject instance = null;
    Texture2D atlas = null;
    try {
    bool urp = (string)spec["pipeline"] == "urp";
    GraphicsSettings.defaultRenderPipeline = urp ? originalPipeline : null;
    QualitySettings.renderPipeline = urp ? originalQuality : null;
    camera.orthographicSize = (float)spec["orthographicSize"];
    var path = (string)spec["prefab"];
    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
    if (prefab == null) throw new Exception("Missing prefab: " + path);
    instance = UnityEngine.Object.Instantiate(prefab);
    instance.SetActive(true);
    instance.transform.rotation = Quaternion.Euler(0, (float?)spec["rotationY"] ?? 0, 0);
    SceneManager.MoveGameObjectToScene(instance, scene);
    foreach (var transform in instance.GetComponentsInChildren<Transform>(true)) transform.gameObject.layer = 30;
    var particles = instance.GetComponentsInChildren<ParticleSystem>(true);
    if (particles.Length == 0) throw new Exception("No particle systems: " + name);
    foreach (var renderer in instance.GetComponentsInChildren<Renderer>(true).Where(r => r.enabled && r.gameObject.activeInHierarchy)) {
      foreach (var material in renderer.sharedMaterials) {
        if (material != null && (material.shader == null || material.shader.name == "Hidden/InternalErrorShader" || !material.shader.isSupported)) throw new Exception("Unsupported material: " + name + "/" + material.name);
      }
    }
    for (int p = 0; p < particles.Length; p++) { particles[p].useAutoRandomSeed = false; particles[p].randomSeed = (uint)(173 + p); }
    atlas = new Texture2D(3072, 3072, TextureFormat.RGBA32, false);
    atlas.hideFlags = HideFlags.HideAndDontSave;
    int visible = 0;
    bool clipped = true;
    for (int attempt = 0; attempt < 4 && clipped; attempt++) {
      clipped = false;
      visible = 0;
      if (attempt > 0) camera.orthographicSize *= 2;
      for (int f = 0; f < 36; f++) {
        foreach (var particle in particles) particle.Simulate((f + 1) / 24f, false, true, true);
        var center = new Vector3(0, .6f, 0);
        if ((bool?)spec["centerFrames"] == true) {
          var positions = new List<Vector3>();
          foreach (var particle in particles) {
            var buffer = new ParticleSystem.Particle[particle.particleCount];
            int count = particle.GetParticles(buffer);
            for (int p = 0; p < count; p++) positions.Add(particle.main.simulationSpace == ParticleSystemSimulationSpace.World ? buffer[p].position : particle.transform.TransformPoint(buffer[p].position));
          }
          if (positions.Count > 0) center = positions.Aggregate(Vector3.zero, (sum, point) => sum + point) / positions.Count;
        }
        camera.transform.position = center + new Vector3(0, 10 * Mathf.Sin(elevation), -10 * Mathf.Cos(elevation));
        camera.transform.LookAt(center);
        if (urp) RenderPipeline.SubmitRenderRequest(camera, new UniversalRenderPipeline.SingleCameraRequest { destination = target });
        else camera.Render();
        RenderTexture.active = target;
        frame.ReadPixels(new Rect(0, 0, 512, 512), 0, 0);
        frame.Apply();
        var pixels = frame.GetPixels();
        visible += pixels.Count(c => Mathf.Max(c.r, c.g, c.b) > .01f);
        int edge = 0;
        for (int p = 0; p < 512; p++) foreach (int index in new[] { p, 511 * 512 + p, p * 512, p * 512 + 511 }) {
          var color = pixels[index];
          if (Mathf.Max(color.r, color.g, color.b) > .06f) edge++;
        }
        if (edge > 8) clipped = true;
        atlas.SetPixels((f % 6) * 512, (5 - f / 6) * 512, 512, 512, pixels);
      }
    }
      if (visible < 100) throw new Exception("Empty render: " + name);
      if (clipped) throw new Exception("Clipped render: " + name);
      atlas.Apply();
      File.WriteAllBytes(Path.Combine(output, name + ".png"), atlas.EncodeToPNG());
      results.Add(new { name, source = path, visible });
    } catch (Exception error) { failures.Add(new { name, error = error.Message }); }
    finally { if (atlas != null) UnityEngine.Object.DestroyImmediate(atlas); if (instance != null) UnityEngine.Object.DestroyImmediate(instance); }
  }
} finally {
  RenderTexture.active = originalActive;
  GraphicsSettings.defaultRenderPipeline = originalPipeline;
  QualitySettings.renderPipeline = originalQuality;
  camera.targetTexture = null;
  target.Release();
  UnityEngine.Object.DestroyImmediate(target);
  UnityEngine.Object.DestroyImmediate(frame);
  EditorSceneManager.ClosePreviewScene(scene);
}
if (failures.Count > 0) throw new Exception(JArray.FromObject(failures).ToString());
return new { rendered = results };
