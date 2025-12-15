from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd
from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.services.nlp import get_nlp_service
from app.config import get_settings


def test_all_questions(
    csv_path: Path,
    output_dir: Path,
    sample_size: int | None = None,
    show_correct: bool = False,
) -> None:
    """Tüm soruları test eder ve sonuçları raporlar."""
    
    print("Model yükleniyor...")
    nlp = get_nlp_service()
    print("Model yüklendi!")
    
    print(f"Veri seti okunuyor: {csv_path}")
    # CSV'yi daha esnek okumak için parametreler
    try:
        df = pd.read_csv(csv_path, quoting=1, on_bad_lines='skip', encoding='utf-8')
    except Exception as e:
        print(f"CSV okuma hatası: {e}")
        # Alternatif: engine='python' kullan
        df = pd.read_csv(csv_path, engine='python', on_bad_lines='skip', encoding='utf-8')
    
    if sample_size:
        df = df.sample(n=min(sample_size, len(df)), random_state=42)
        print(f"Örnekleme yapıldı: {len(df)} soru test edilecek")
    
    print(f"Toplam {len(df)} soru test ediliyor...")
    
    results = []
    errors = []
    answer_groups = defaultdict(list)
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Test ediliyor"):
        question = str(row["question"]).strip()
        expected_answer = str(row["answer"]).strip()
        
        try:
            prediction = nlp.predict(question)
            predicted_answer = prediction.text.strip()
            confidence = prediction.confidence
            
            is_correct = predicted_answer == expected_answer
            
            result = {
                "question": question,
                "expected_answer": expected_answer,
                "predicted_answer": predicted_answer,
                "confidence": confidence,
                "is_correct": is_correct,
                "category": prediction.category,
                "subcategory": prediction.subcategory,
            }
            
            results.append(result)
            
            # Hatalı tahminleri kaydet
            if not is_correct:
                errors.append(result)
            
            # Doğru veya tüm sonuçları grupla
            if is_correct or show_correct:
                answer_groups[expected_answer].append({
                    "question": question,
                    "predicted": predicted_answer,
                    "is_correct": is_correct,
                    "confidence": confidence,
                })
        
        except Exception as e:
            error_result = {
                "question": question,
                "expected_answer": expected_answer,
                "predicted_answer": f"HATA: {str(e)}",
                "confidence": 0.0,
                "is_correct": False,
                "category": None,
                "subcategory": None,
            }
            results.append(error_result)
            errors.append(error_result)
            print(f"\nHata (satır {idx}): {question} -> {e}")
    
    # İstatistikler
    total = len(results)
    correct = sum(1 for r in results if r["is_correct"])
    accuracy = (correct / total * 100) if total > 0 else 0
    
    print(f"\n{'='*60}")
    print(f"TEST SONUÇLARI")
    print(f"{'='*60}")
    print(f"Toplam soru: {total}")
    print(f"Doğru tahmin: {correct}")
    print(f"Yanlış tahmin: {total - correct}")
    print(f"Doğruluk oranı: {accuracy:.2f}%")
    print(f"Hata oranı: {100 - accuracy:.2f}%")
    print(f"{'='*60}\n")
    
    # Çıktı dizinini oluştur
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Tüm sonuçları CSV olarak kaydet
    results_df = pd.DataFrame(results)
    results_csv = output_dir / "all_predictions.csv"
    results_df.to_csv(results_csv, index=False, encoding="utf-8-sig")
    print(f"Tüm sonuçlar kaydedildi: {results_csv}")
    
    # 2. Sadece hatalı tahminleri kaydet
    if errors:
        errors_df = pd.DataFrame(errors)
        errors_csv = output_dir / "errors_only.csv"
        errors_df.to_csv(errors_csv, index=False, encoding="utf-8-sig")
        print(f"Hatalı tahminler kaydedildi: {errors_csv}")
        print(f"Toplam {len(errors)} hatalı tahmin var")
    
    # 3. Cevap tiplerine göre gruplandırılmış rapor
    answer_report = {}
    for answer, questions in answer_groups.items():
        correct_count = sum(1 for q in questions if q["is_correct"])
        total_count = len(questions)
        accuracy = (correct_count / total_count * 100) if total_count > 0 else 0
        
        # Örnek sorular (doğru ve yanlış)
        correct_examples = [q["question"] for q in questions if q["is_correct"]][:5]
        wrong_examples = [q["question"] for q in questions if not q["is_correct"]][:5]
        
        answer_report[answer] = {
            "total_questions": total_count,
            "correct_predictions": correct_count,
            "wrong_predictions": total_count - correct_count,
            "accuracy": accuracy,
            "example_questions_correct": correct_examples,
            "example_questions_wrong": wrong_examples,
            "all_questions": [q["question"] for q in questions],
        }
    
    # Cevap tiplerine göre raporu kaydet
    report_json = output_dir / "answer_type_report.json"
    with report_json.open("w", encoding="utf-8") as f:
        json.dump(answer_report, f, ensure_ascii=False, indent=2)
    print(f"Cevap tiplerine göre rapor kaydedildi: {report_json}")
    
    # 4. Özet HTML raporu oluştur
    html_report = output_dir / "report.html"
    create_html_report(results, errors, answer_report, accuracy, html_report)
    print(f"HTML rapor oluşturuldu: {html_report}")
    
    # 5. Konsola özet göster
    print(f"\n{'='*60}")
    print("CEVAP TİPLERİNE GÖRE ÖZET")
    print(f"{'='*60}")
    
    # Doğruluk oranına göre sırala
    sorted_answers = sorted(
        answer_report.items(),
        key=lambda x: x[1]["accuracy"]
    )
    
    print(f"\nEn çok hata olan cevap tipleri (ilk 10):")
    for answer, stats in sorted_answers[:10]:
        print(f"\nCevap: {answer[:80]}...")
        print(f"  Toplam soru: {stats['total_questions']}")
        print(f"  Doğru: {stats['correct_predictions']} | Yanlış: {stats['wrong_predictions']}")
        print(f"  Doğruluk: {stats['accuracy']:.1f}%")
        if stats['example_questions_wrong']:
            print(f"  Örnek yanlış tahminler:")
            for q in stats['example_questions_wrong'][:3]:
                print(f"    - {q}")
    
    print(f"\n{'='*60}")
    print(f"Raporlar '{output_dir}' klasörüne kaydedildi.")
    print(f"{'='*60}")


def create_html_report(
    results: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    answer_report: dict[str, Any],
    overall_accuracy: float,
    output_path: Path,
) -> None:
    """HTML raporu oluşturur."""
    
    html_content = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Test Raporu</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }}
        .stat-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-card h3 {{
            margin: 0;
            font-size: 2.5em;
        }}
        .stat-card p {{
            margin: 5px 0 0 0;
            opacity: 0.9;
        }}
        .error-card {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        .correct-card {{
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #4CAF50;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
        }}
        .badge-correct {{
            background-color: #28a745;
            color: white;
        }}
        .badge-error {{
            background-color: #dc3545;
            color: white;
        }}
        .answer-group {{
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }}
        .answer-group h3 {{
            color: #495057;
            margin-top: 0;
        }}
        .question-list {{
            margin: 10px 0;
        }}
        .question-list li {{
            margin: 5px 0;
            padding: 5px;
        }}
        .wrong-question {{
            color: #dc3545;
            font-weight: bold;
        }}
        .correct-question {{
            color: #28a745;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Model Test Raporu</h1>
        
        <div class="stats">
            <div class="stat-card">
                <h3>{len(results)}</h3>
                <p>Toplam Soru</p>
            </div>
            <div class="stat-card">
                <h3>{sum(1 for r in results if r['is_correct'])}</h3>
                <p>Doğru Tahmin</p>
            </div>
            <div class="stat-card">
                <h3>{len(errors)}</h3>
                <p>Yanlış Tahmin</p>
            </div>
            <div class="stat-card">
                <h3>{overall_accuracy:.2f}%</h3>
                <p>Doğruluk Oranı</p>
            </div>
        </div>
        
        <h2>Cevap Tiplerine Göre Detaylı Rapor</h2>
        <p>Her cevap tipi için hangi sorulara doğru/yanlış cevap verildiğini görebilirsiniz.</p>
        
"""
    
    # Cevap tiplerine göre rapor
    sorted_answers = sorted(
        answer_report.items(),
        key=lambda x: (x[1]["wrong_predictions"], -x[1]["total_questions"]),
        reverse=True
    )
    
    for answer, stats in sorted_answers:
        accuracy_color = "#28a745" if stats["accuracy"] >= 90 else "#ffc107" if stats["accuracy"] >= 70 else "#dc3545"
        
        html_content += f"""
        <div class="answer-group">
            <h3>Cevap: <span style="color: {accuracy_color}">{answer[:200]}{'...' if len(answer) > 200 else ''}</span></h3>
            <p><strong>Toplam Soru:</strong> {stats['total_questions']} | 
               <strong>Doğru:</strong> {stats['correct_predictions']} | 
               <strong>Yanlış:</strong> {stats['wrong_predictions']} | 
               <strong>Doğruluk:</strong> <span style="color: {accuracy_color}; font-weight: bold;">{stats['accuracy']:.1f}%</span></p>
            
            <details>
                <summary style="cursor: pointer; color: #667eea; font-weight: bold; margin: 10px 0;">
                    Tüm Soruları Göster ({stats['total_questions']} soru)
                </summary>
                <ul class="question-list">
"""
        
        for q_info in stats["all_questions"]:
            if isinstance(q_info, dict):
                question = q_info.get("question", "")
                is_correct = q_info.get("is_correct", False)
                confidence = q_info.get("confidence", 0)
                predicted = q_info.get("predicted", "")
                
                status_class = "correct-question" if is_correct else "wrong-question"
                status_icon = "✅" if is_correct else "❌"
                
                html_content += f"""
                    <li class="{status_class}">
                        {status_icon} <strong>{question}</strong>
                        {'' if is_correct else f'<br>&nbsp;&nbsp;&nbsp;&nbsp;→ Beklenen: {answer[:100]}<br>&nbsp;&nbsp;&nbsp;&nbsp;→ Tahmin: {predicted[:100]} (Güven: {confidence:.2%})'}
                    </li>
"""
            else:
                # Eski format (sadece string)
                html_content += f'<li>{q_info}</li>'
        
        html_content += """
                </ul>
            </details>
        </div>
"""
    
    html_content += """
    </div>
</body>
</html>
"""
    
    with output_path.open("w", encoding="utf-8") as f:
        f.write(html_content)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Model tahminlerini test et")
    parser.add_argument(
        "--data-path",
        type=Path,
        default=ROOT_DIR / "data" / "raw" / "train.csv",
        help="Test edilecek CSV dosyası",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT_DIR / "data" / "test_results",
        help="Raporların kaydedileceği dizin",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=None,
        help="Test edilecek örnek sayısı (tüm veri seti için None)",
    )
    parser.add_argument(
        "--show-correct",
        action="store_true",
        help="Doğru tahminleri de raporlara dahil et",
    )
    
    args = parser.parse_args()
    
    test_all_questions(
        csv_path=args.data_path,
        output_dir=args.output_dir,
        sample_size=args.sample_size,
        show_correct=args.show_correct,
    )

