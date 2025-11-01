from openai import OpenAI
import json
import time

client = OpenAI(api_key="")

def score_candidate(profile_text):
    prompt = f"""Analyze this LinkedIn profile to evaluate hackathon partnership potential.

Profile:
\"\"\"{profile_text}\"\"\"

Extract and score the following:

1. Parse their education (university name, degree/course) and work experience (count internships + jobs)
2. Identify hackathon wins mentioned (count them, or note if unavailable)
3. Score on 1-100 scale:
   - Technical Skill: Depth of technical projects, languages, frameworks, system design. Calibrate assuming a population of university students where median = 50, top 10% = 80+, exceptional = 90+
   - Collaboration: Teamwork indicators, leadership roles, group projects, communication ability. Same calibration.
   - Overall: Holistic assessment of hackathon readiness combining technical + collaboration + execution track record. Same calibration.
   
   CRITICAL: Distribute scores to reflect percentile ranking. Avoid clustering around 70-80. Most candidates should fall 40-70 range, with only truly exceptional profiles scoring 85+.

4. If overall score > 75: Write one paragraph (3-4 sentences) summarizing their interests and background.

Return strictly as JSON:
{{
  "university": "<name>",
  "course": "<degree/major>",
  "work_experience_count": <number>,
  "hackathons_won": <number or "unavailable">,
  "technical_skill": <1-100>,
  "collaboration": <1-100>,
  "overall_score": <1-100>,
  "summary": "<paragraph if overall > 75, else empty string>"
}}"""

    response = client.chat.completions.create(
        model="gpt-5-nano",
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
