using UnityEngine;
using UnityEngine.InputSystem;

namespace SLU.Traversal
{
    public sealed class TraversalSession : MonoBehaviour
    {
        public int RoomIndex { get; private set; }
        public int Kills { get; private set; }
        public float RoomTime { get; private set; }
        public TraversalPlayer Player { get; private set; }
        public WarpSystem Warp { get; private set; }
        Transform _content;
        RoomSpec Current => TraversalRoomCatalog.ActI[RoomIndex];

        void Update()
        {
            RoomTime += Time.deltaTime;
            if (Keyboard.current?.rKey.wasPressedThisFrame == true) ReloadRoom();
            if (!Player) return;
            if (Kills >= Current.requiredKills && Vector3.Distance(Player.transform.position, Current.goal) < 2.2f)
                AdvanceRoom();
        }

        public void Initialize(TraversalPlayer player, WarpSystem warp)
        {
            Player = player;
            Warp = warp;
            LoadRoom(0);
        }

        public void RegisterKill(WarpTarget target, Vector3 shotOrigin, Vector3 endpoint) => Kills++;

        public void ReloadRoom() => LoadRoom(RoomIndex);

        void AdvanceRoom()
        {
            int next = RoomIndex + 1;
            if (next >= TraversalRoomCatalog.ActI.Length)
            {
                Debug.Log($"TRAVERSAL ACT I COMPLETE — final room time {RoomTime:0.000}s");
                next = 0;
            }
            LoadRoom(next);
        }

        public void LoadRoom(int index)
        {
            RoomIndex = Mathf.Clamp(index, 0, TraversalRoomCatalog.ActI.Length - 1);
            Kills = 0;
            RoomTime = 0f;
            Warp.ResetWarp();
            if (_content) Destroy(_content.gameObject);
            _content = new GameObject($"{Current.id} — {Current.title}").transform;

            foreach (var p in Current.platforms) CreatePlatform(p);
            foreach (var t in Current.targets) CreateTarget(t);
            CreateGoal(Current.goal);

            var body = Player.GetComponent<CharacterController>();
            body.enabled = false;
            Player.transform.position = Current.spawn - Vector3.up * TraversalPlayer.StandEyeHeight;
            Player.transform.rotation = Quaternion.identity;
            body.enabled = true;
            Debug.Log($"TRAVERSAL {Current.title}: {Current.lesson}");
        }

        void CreatePlatform(PlatformSpec spec)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "Platform";
            go.transform.SetParent(_content);
            go.transform.position = spec.center;
            go.transform.localScale = spec.size;
            go.GetComponent<Renderer>().material.color = new Color(0.06f,0.08f,0.11f);
        }

        void CreateTarget(TargetSpec spec)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = spec.id;
            go.transform.SetParent(_content);
            go.transform.position = spec.position;
            go.transform.localScale = Vector3.one * 1.35f;
            go.GetComponent<Renderer>().material.color = spec.shielded ? new Color(1f,.72f,.2f) : new Color(.25f,.95f,1f);
            var target = go.AddComponent<WarpTarget>();
            target.targetId = spec.id;
            target.driftAxis = spec.driftAxis;
            target.driftAmplitude = spec.driftAmplitude;
            target.driftSpeed = spec.driftSpeed;
            target.shielded = spec.shielded;
        }

        void CreateGoal(Vector3 position)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = "Gravity Ring / Exit";
            go.transform.SetParent(_content);
            go.transform.position = position + Vector3.up * .2f;
            go.transform.localScale = new Vector3(1.8f,.08f,1.8f);
            Destroy(go.GetComponent<Collider>());
            go.GetComponent<Renderer>().material.color = new Color(.8f,.9f,1f);
        }
    }
}
