using UnityEngine;

namespace SLU.Traversal
{
    /// <summary>
    /// Zero-scene bootstrap: opening this Unity project and pressing Play is enough to run the port.
    /// Later this becomes a normal authored scene/prefab composition without changing gameplay systems.
    /// </summary>
    public static class TraversalBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (Object.FindFirstObjectByType<TraversalSession>()) return;

            var root = new GameObject("TRAVERSAL Runtime");
            var warp = root.AddComponent<WarpSystem>();
            warp.Initialize();

            var playerGo = new GameObject("Player");
            playerGo.transform.SetParent(root.transform);
            playerGo.AddComponent<CharacterController>();

            var cameraGo = new GameObject("FPS Camera");
            cameraGo.transform.SetParent(playerGo.transform);
            cameraGo.transform.localPosition = Vector3.up * TraversalPlayer.StandEyeHeight;
            var camera = cameraGo.AddComponent<Camera>();
            camera.fieldOfView = 82f;
            camera.nearClipPlane = 0.03f;
            cameraGo.AddComponent<AudioListener>();

            var player = playerGo.AddComponent<TraversalPlayer>();
            player.Initialize(camera, warp);

            var session = root.AddComponent<TraversalSession>();
            session.Initialize(player, warp);

            CreateLighting(root.transform);
            Debug.Log("TRAVERSAL Unity port booted. LMB fire | RMB hold/release warp | wheel stop-short | WASD move | Ctrl/C crouch | R restart.");
        }

        static void CreateLighting(Transform root)
        {
            RenderSettings.ambientLight = new Color(.13f,.16f,.22f);
            var lightGo = new GameObject("Directional Light");
            lightGo.transform.SetParent(root);
            lightGo.transform.rotation = Quaternion.Euler(48f,-32f,0f);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.35f;
            light.color = new Color(.78f,.88f,1f);
        }
    }
}
