from openai import OpenAI
from pydantic import BaseModel, Field
from typing import Optional, Union
import time

client = OpenAI(api_key="")

class HackathonEvaluation(BaseModel):
    hackathons_won: Union[int, str] = Field(description="Number of hackathons won, or 'unavailable' if not mentioned")
    technical_skill: int = Field(ge=1, le=100, description="Technical skill score 1-100")
    technical_skill_summary: str = Field(description="Paragraph summary of technıcal skılls if overall_score > 75 or under 20, otherwise empty string")
    collaboration: int = Field(ge=1, le=100, description="Collaboration score 1-100")
    collaboration_summary: str = Field(description="Paragraph summary if overall_score > 75 or under 20, otherwise empty string")
    overall_score: int = Field(ge=1, le=100, description="Overall hackathon readiness score 1-100")
    summary: str = Field(description="Paragraph summary if overall_score > 75 or under 20, otherwise empty string")

def score_candidate(profile_text):
    prompt = f"""Analyze this LinkedIn profile to evaluate hackathon partnership potential.

Profile:
\"\"\"{profile_text}\"\"\"

Extract and score:

1. Hackathons won: count if mentioned, otherwise use "unavailable"
2. Scores (1-100 scale with percentile calibration):
   - Technical Skill: Depth of technical projects, languages, frameworks, system design
   - Collaboration: Teamwork indicators, leadership roles, group projects, communication ability
   - Overall: Holistic hackathon readiness combining technical + collaboration + execution track record

CALIBRATION: Population of university students where median = 50, top 10% = 80+, exceptional = 90+. Distribute scores across 40-70 range for most candidates. Only truly exceptional profiles score 85+. Avoid clustering around 70-80.

3. Summary: If overall_score > 75 or under 20, write one paragraph (3-4 sentences) summarizing interests and background. Otherwise, leave empty string."""

    response = client.chat.completions.parse(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format=HackathonEvaluation
    )
    
    return response.choices[0].message.parsed

def evaluate_all(candidates):
    results = []
    for i, candidate in enumerate(candidates, start=1):
        print(f"Evaluating {i}/{len(candidates)}: {candidate['name']}")
        evaluation = score_candidate(candidate["profile_text"])
        results.append({
            "name": candidate["name"],
            "evaluation": evaluation.model_dump()
        })
        time.sleep(1)
    
    return results

# Example usage:
candidates = [
    {"name": "Seung Yoon", "profile_text": "..."},
    {"name": "Ryan Choong", "profile_text": "..."}
]

results = evaluate_all(candidates)

# Sort by overall_score
ranked = sorted(results, key=lambda x: x["evaluation"]["overall_score"], reverse=True)

# Save to file
with open("hackathon_rankings.json", "w") as f:
    import json
    json.dump(ranked, f, indent=2)

# Print rankings
print("\n=== RANKINGS ===")
for i, r in enumerate(ranked, 1):
    e = r["evaluation"]
    print(f"{i}. {r['name']}: {e['overall_score']}/100")
    print(f"   Tech: {e['technical_skill']} | Collab: {e['collaboration']}")
    print(f"   {e['university']} - {e['course']}")
    print(f"   Experience: {e['work_experience_count']} | Hackathons Won: {e['hackathons_won']}")
    if e['summary']:
        print(f"   Summary: {e['summary']}")
    print()
