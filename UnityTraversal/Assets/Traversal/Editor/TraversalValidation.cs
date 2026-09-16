#if UNITY_EDITOR
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace SLU.Traversal.Editor
{
    public static class TraversalValidation
    {
        [MenuItem("Traversal/Validate Native Port")]
        public static void Validate()
        {
            int errors = 0;

            errors += CheckType<TraversalBootstrap>();
            errors += CheckType<TraversalPlayer>();
            errors += CheckType<WarpSystem>();
            errors += CheckType<WarpTarget>();
            errors += CheckType<TraversalSession>();

            var rooms = TraversalRoomCatalog.ActI;
            if (rooms == null || rooms.Length != 8)
            {
                Debug.LogError($"Traversal validation: expected 8 Act I rooms, found {rooms?.Length ?? 0}.");
                errors++;
            }
            else
            {
                for (int i = 0; i < rooms.Length; i++)
                {
                    var room = rooms[i];
                    if (string.IsNullOrWhiteSpace(room.id) || room.platforms == null || room.platforms.Length == 0)
                    {
                        Debug.LogError($"Traversal validation: room {i + 1} is missing required data.");
                        errors++;
                    }
                    if (room.targets == null || room.targets.Length < room.requiredKills)
                    {
                        Debug.LogError($"Traversal validation: {room.id} requires {room.requiredKills} kills but only has {room.targets?.Length ?? 0} targets.");
                        errors++;
                    }
                }
            }

            if (errors == 0)
                Debug.Log("TRAVERSAL NATIVE PORT VALIDATION PASSED — core scripts present and all 8 Act I room specs are structurally valid.");
            else
                Debug.LogError($"TRAVERSAL NATIVE PORT VALIDATION FAILED — {errors} issue(s). See errors above.");
        }

        static int CheckType<T>()
        {
            return typeof(T) == null ? 1 : 0;
        }
    }
}
#endif
