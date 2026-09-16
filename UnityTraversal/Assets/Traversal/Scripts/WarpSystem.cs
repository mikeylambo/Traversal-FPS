using UnityEngine;

namespace SLU.Traversal
{
    /// <summary>Native Unity port of the web WarpSystem. Keeps the same selection and transit constants.</summary>
    public sealed class WarpSystem : MonoBehaviour
    {
        public const float MinFraction = 0.12f;
        public const float WheelStep = 0.04f;
        public const float WarpSpeed = 82f;
        public const float MinDuration = 0.075f;

        public bool HasAnchor { get; private set; }
        public bool IsTransiting { get; private set; }
        public int SelectionPercent => Mathf.RoundToInt(_fraction * 100f);
        public Vector3 SelectedPoint => Vector3.Lerp(_origin, _target, _fraction);

        Vector3 _origin;
        Vector3 _target;
        Vector3 _from;
        Vector3 _to;
        float _fraction = 1f;
        float _elapsed;
        float _duration;

        LineRenderer _fullLine;
        LineRenderer _selectedLine;
        Transform _marker;

        public void Initialize()
        {
            _fullLine = CreateLine("Written Vector", 0.018f, new Color(0.75f, 0.99f, 1f, 0.78f));
            _selectedLine = CreateLine("Selected Vector", 0.055f, new Color(0.21f, 0.91f, 1f, 0.38f));

            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "Warp Landing Marker";
            marker.transform.localScale = Vector3.one * 0.26f;
            Destroy(marker.GetComponent<Collider>());
            marker.GetComponent<Renderer>().material.color = new Color(0.7f, 1f, 1f);
            marker.SetActive(false);
            _marker = marker.transform;
        }

        public void Write(Vector3 origin, Vector3 target)
        {
            _origin = origin;
            _target = target;
            _fraction = 1f;
            HasAnchor = true;
            RefreshVisuals(false);
        }

        public void AdjustSelection(float wheelDelta)
        {
            if (!HasAnchor || Mathf.Approximately(wheelDelta, 0f)) return;
            _fraction = Mathf.Clamp(_fraction - wheelDelta * WheelStep, MinFraction, 1f);
        }

        public void UpdateSelectionVisual(bool held)
        {
            if (!HasAnchor) return;
            RefreshVisuals(held);
            _marker.gameObject.SetActive(held);
            if (held)
            {
                _marker.position = SelectedPoint;
                float pulse = 1f + Mathf.Sin(Time.time * 11f) * 0.1f;
                float shortScale = _fraction < 0.995f ? 1.16f : 1f;
                _marker.localScale = Vector3.one * (0.26f * pulse * shortScale);
            }
        }

        public bool Commit(Vector3 currentPosition)
        {
            if (!HasAnchor || IsTransiting) return false;
            _from = currentPosition;
            _to = SelectedPoint;
            _elapsed = 0f;
            _duration = Mathf.Max(MinDuration, Vector3.Distance(_from, _to) / WarpSpeed);
            HasAnchor = false;
            IsTransiting = true;
            SetLines(false);
            _marker.gameObject.SetActive(false);
            return true;
        }

        public bool TickTransit(float dt, ref Vector3 position)
        {
            if (!IsTransiting) return false;
            _elapsed += dt;
            float raw = Mathf.Clamp01(_elapsed / _duration);
            float eased = raw < 0.5f
                ? 4f * raw * raw * raw
                : 1f - Mathf.Pow(-2f * raw + 2f, 3f) / 2f;
            position = Vector3.LerpUnclamped(_from, _to, eased);
            if (raw >= 1f) IsTransiting = false;
            return true;
        }

        public void ResetWarp()
        {
            HasAnchor = false;
            IsTransiting = false;
            _fraction = 1f;
            SetLines(false);
            if (_marker) _marker.gameObject.SetActive(false);
        }

        void RefreshVisuals(bool selecting)
        {
            if (!HasAnchor) return;
            _fullLine.SetPosition(0, _origin);
            _fullLine.SetPosition(1, _target);
            _selectedLine.SetPosition(0, _origin);
            _selectedLine.SetPosition(1, selecting ? SelectedPoint : _target);
            _fullLine.enabled = true;
            _selectedLine.enabled = true;
        }

        void SetLines(bool enabled)
        {
            if (_fullLine) _fullLine.enabled = enabled;
            if (_selectedLine) _selectedLine.enabled = enabled;
        }

        static LineRenderer CreateLine(string name, float width, Color color)
        {
            var go = new GameObject(name);
            var line = go.AddComponent<LineRenderer>();
            line.positionCount = 2;
            line.startWidth = width;
            line.endWidth = width;
            line.material = new Material(Shader.Find("Sprites/Default"));
            line.startColor = color;
            line.endColor = color;
            line.enabled = false;
            return line;
        }
    }
}
