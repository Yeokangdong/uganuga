using System;
using System.Collections.Generic;
using UnityEngine;

namespace Uganuga.UnityStageOne
{
    [Serializable] public sealed class AtlasFrame { public int x, y, w, h; public float footX, footY; }
    [Serializable] public sealed class AtlasClip { public string key, texture; public float fps = 6, ppu = 80; public AtlasFrame[] frames; }
    [Serializable] public sealed class AtlasDocument { public AtlasClip[] clips; }

    public sealed class StageArt
    {
        readonly Dictionary<string, Sprite[]> sprites = new Dictionary<string, Sprite[]>();
        readonly Dictionary<string, float> rates = new Dictionary<string, float>();
        public void Load()
        {
            var json = Resources.Load<TextAsset>("Art/atlas");
            if (!json) { Debug.LogError("Missing Resources/Art/atlas.json"); return; }
            var document = JsonUtility.FromJson<AtlasDocument>(json.text);
            foreach (var clip in document.clips)
            {
                var texture = Resources.Load<Texture2D>(clip.texture);
                if (!texture) { Debug.LogError("Missing art texture: " + clip.texture); continue; }
                var frames = new List<Sprite>();
                foreach (var frame in clip.frames)
                {
                    var rect = new Rect(frame.x, texture.height - frame.y - frame.h, frame.w, frame.h);
                    if (frame.w <= 0 || frame.h <= 0 || rect.xMin < 0 || rect.yMin < 0 || rect.xMax > texture.width || rect.yMax > texture.height)
                        throw new InvalidOperationException("Invalid atlas rect in " + clip.key);
                    var pivot = new Vector2(frame.footX / frame.w, 1f - frame.footY / frame.h);
                    frames.Add(Sprite.Create(texture, rect, pivot, clip.ppu, 0, SpriteMeshType.FullRect));
                }
                sprites[clip.key] = frames.ToArray();
                rates[clip.key] = clip.fps;
            }
        }
        public bool Has(string key) => sprites.ContainsKey(key) && sprites[key].Length > 0;
        public Sprite Get(string key, float phase = 0)
        {
            if (!Has(key)) return null;
            var frames = sprites[key];
            return frames[Mathf.Abs(Mathf.FloorToInt(phase * rates[key])) % frames.Length];
        }
        public Sprite Frame(string key, int index = 0)
        {
            if (!Has(key)) return null;
            var frames = sprites[key];
            return frames[Mathf.Clamp(index, 0, frames.Length - 1)];
        }
        public int Count(string key) => Has(key) ? sprites[key].Length : 0;
    }
}
