import sys
import os
import json
import time
import pandas as pd
from tqdm import tqdm

# Change working directory to model/ so app.py finds its data relative to itself
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'model'))
os.chdir(MODEL_DIR)
sys.path.append(MODEL_DIR)

# Import necessary components from your app
# We need to initialize the app context to use the LLM
from app import load_models, load_car_data, generate_car_summary

# Initialize Global Models
print("Initializing Models for Evaluation...")
embedding_model, llm = load_models()
df = load_car_data()

def get_judge_score(metric_name, question, context, answer, ground_truth=None):
    """
    Uses the LLM itself to judge the quality of the response.
    Returns a score between 0.0 and 1.0 and a reasoning.
    """
    if metric_name == "Faithfulness":
        prompt = f"""
        You are an unbiased evaluator. Rate the FAITHFULNESS of the actual answer based strictly on the retrieved context.
        
        RETRIEVED CONTEXT:
        {context}
        
        ACTUAL ANSWER:
        {answer}
        
        Criteria:
        - Score 1.0 if the answer claims are fully supported by the context.
        - Score 0.0 if the answer makes up information not present in the context.
        
        Output strictly valid JSON:
        {{
            "score": <float 0.0 to 1.0>,
            "reason": "<brief explanation>"
        }}
        """
    elif metric_name == "Answer Relevancy":
        prompt = f"""
        You are an unbiased evaluator. Rate the RELEVANCY of the actual answer to the user's question.
        
        USER QUESTION:
        {question}
        
        ACTUAL ANSWER:
        {answer}
        
        Criteria:
        - Score 1.0 if the answer directly addresses the question.
        - Score 0.0 if the answer is completely unrelated or ignores the question.
        
        Output strictly valid JSON:
        {{
            "score": <float 0.0 to 1.0>,
            "reason": "<brief explanation>"
        }}
        """
    
    try:
        response = llm.invoke(prompt)
        content = response.content.strip()
        # Simple extraction
        if '{' in content and '}' in content:
            start = content.find('{')
            end = content.rfind('}') + 1
            data = json.loads(content[start:end])
            return data['score'], data['reason']
    except Exception as e:
        print(f"Evaluation Error ({metric_name}): {e}")
        return 0.0, "Error"
    
    return 0.0, "Parse Error"

def run_evaluation():
    # Load Test Data
    # Use absolute path since we changed cwd to model/
    dataset_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'test_dataset.json'))
    with open(dataset_path, 'r') as f:
        test_cases = json.load(f)
    
    results = []
    
    print(f"\nRunning Evaluation on {len(test_cases)} test cases...\n")
    
    for case in tqdm(test_cases):
        question = case['question']
        
        # 1. Simulate Retrieval (Improved)
        # Filter for cars that match ALL the first 2 keywords (assumed to be Make/Model)
        # This is a heuristic for the test script. Real app uses semantic search.
        make_model = case['expected_context_keywords'][:2]
        
        matched_cars = df[df['variant'].apply(lambda x: all(k.lower() in str(x).lower() for k in make_model))]
        
        if matched_cars.empty:
             # Fallback to Any match
             matched_cars = df[df['variant'].apply(lambda x: any(k.lower() in str(x).lower() for k in make_model))]
        
        if matched_cars.empty:
            matched_cars = df.head(5) # Fallback
        
        context_text = "\n".join([generate_car_summary(car) for _, car in matched_cars.head(3).iterrows()])
        
        # 2. Generate Answer (using the LLM with the context)
        # We manually invoke the generation prompt used in app.py
        gen_prompt = f"""
        Context: {context_text}
        Question: {question}
        Answer based strictly on the context:
        """
        response = llm.invoke(gen_prompt)
        actual_answer = response.content.strip()
        
        # 3. Judge: Faithfulness
        f_score, f_reason = get_judge_score("Faithfulness", question, context_text, actual_answer)
        
        # 4. Judge: Relevancy
        r_score, r_reason = get_judge_score("Answer Relevancy", question, context_text, actual_answer)
        
        results.append({
            "question": question,
            "answer": actual_answer,
            "faithfulness": f_score,
            "faithfulness_reason": f_reason,
            "relevancy": r_score,
            "relevancy_reason": r_reason
        })
        
    # Calculate Averages
    avg_faithfulness = sum(r['faithfulness'] for r in results) / len(results)
    avg_relevancy = sum(r['relevancy'] for r in results) / len(results)
    
    report = {
        "summary": {
            "total_tests": len(results),
            "average_faithfulness": round(avg_faithfulness, 2),
            "average_relevancy": round(avg_relevancy, 2),
            "overall_score": round((avg_faithfulness + avg_relevancy) / 2, 2)
        },
        "detailed_results": results
    }
    
    # Save Report
    report_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'evaluation_report.json'))
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
        
    print("\n" + "="*50)
    print("EVALUATION COMPLETE")
    print(f"Faithfulness Score: {avg_faithfulness:.2f}/1.0")
    print(f"Relevancy Score:    {avg_relevancy:.2f}/1.0")
    print("="*50)
    print(f"Report saved to {report_path}")

if __name__ == "__main__":
    run_evaluation()
