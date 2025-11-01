from openai import OpenAI
import json
import time

client = OpenAI(api_key="")

def score_candidate(profile_text):
    prompt = f"""
You are an expert hackathon mentor. Evaluate the candidate for potential hackathon performance.

Candidate profile:
\"\"\"{profile_text}\"\"\"

Rate across 5 categories: Technical, Creativity, Communication, Teamwork, and Ownership (1–10 each).
Also provide a short justification (1–2 sentences).

Return your answer strictly as JSON in this format:
{{
  "technical": <score>,
  "creativity": <score>,
Candidate profile:
\"\"\"{profile_text}\"\"\"

Rate across 5 categories: Technical, Creativity, Communication, Teamwork, and Ownership (1–10 each).
Also provide a short justification (1–2 sentences).

Return your answer strictly as JSON in this format:
{{
  "technical": <score>,
  "creativity": <score>,
  "communication": <score>,
  "teamwork": <score>,
  "ownership": <score>,
  "total_score": <sum of all>,
  "reasoning": "<short summary>"
}}
"""
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    content = response.choices[0].message.content.strip()
    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        result = {"error": "Invalid JSON", "raw": content}
    return result


def evaluate_all(candidates):
    results = []
    for i, candidate in enumerate(candidates, start=1):
        print(f"Evaluating candidate {i}/{len(candidates)}: {candidate['name']}")
        scores = score_candidate(candidate["profile_text"])
        results.append({
            "name": candidate["name"],
            "scores": scores
        })
        # small delay to avoid rate limits
        time.sleep(1)
    return results


# Example usage:
candidates = [
    {"name": "Seung Yoon", "profile_text": "..."},
    {"name": "Ryan Choong", "profile_text": "..."}
]

results = evaluate_all(candidates)

# Sort by total score
ranked = sorted(results, key=lambda x: x["scores"].get("total_score", 0), reverse=True)

# Save to file
with open("hackathon_rankings.json", "w") as f:
    json.dump(ranked, f, indent=2)

# Print top candidates
for r in ranked:
    print(f"{r['name']}: {r['scores'].get('total_score', '?')} — {r['scores'].get('reasoning', '')}")
