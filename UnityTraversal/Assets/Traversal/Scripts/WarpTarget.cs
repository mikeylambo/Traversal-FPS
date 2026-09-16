using UnityEngine;

namespace SLU.Traversal
{
    public sealed class WarpTarget : MonoBehaviour
    {
        public string targetId;
        public Vector3 driftAxis;
        public float driftAmplitude;
        public float driftSpeed;
        public bool shielded;
        Vector3 _origin;

        void Awake() => _origin = transform.position;
        void Update()
        {
            if (driftAmplitude > 0f && driftAxis.sqrMagnitude > 0.01f)
                transform.position = _origin + driftAxis.normalized * (Mathf.Sin(Time.time * driftSpeed) * driftAmplitude);
            transform.Rotate(0f, 45f * Time.deltaTime, 0f, Space.World);
        }

        public bool TryKill(Vector3 shotOrigin, Vector3 shotDirection)
        {
            if (shielded)
            {
                Vector3 incoming = (shotOrigin - transform.position).normalized;
                // Frontal cone rejects shots; lateral origin solves the room.
                Vector3 front = Vector3.back;
                if (Vector3.Dot(incoming, front) > 0.62f) return false;
            }
            var session = FindFirstObjectByType<TraversalSession>();
            if (session) session.RegisterKill(this, shotOrigin, transform.position);
            Destroy(gameObject);
            return true;
        }
    }
}
