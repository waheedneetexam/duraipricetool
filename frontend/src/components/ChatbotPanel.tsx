import { useState } from 'react';
import { apiFetch } from '../api/client';

type ChatResult = { generated_sql: string; result: Record<string, unknown>[] };

export function ChatbotPanel() {
  const [question, setQuestion] = useState('What was the margin leak in Q3?');
  const [answer, setAnswer] = useState<ChatResult | null>(null);
  const [error, setError] = useState('');

  async function ask() {
    setError('');
    try {
      const data = await apiFetch<ChatResult>('/chatbot/ask', {
        method: 'POST',
        body: JSON.stringify({ question })
      });
      setAnswer(data);
    } catch (err) {
      setError(String(err));
    }
  }

  const headers = answer?.result.length ? Object.keys(answer.result[0]) : [];

  return (
    <section className="panel">
      <h2>Pricing Copilot (NL to SQL)</h2>
      <div className="card">
        <div className="row-wrap">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className="grow" />
          <button onClick={ask}>Ask</button>
        </div>
      </div>

      {answer && (
        <>
          <div className="card">
            <h3>Generated SQL</h3>
            <pre>{answer.generated_sql}</pre>
          </div>

          <div className="card">
            <h3>Result</h3>
            <div className="drill-table-wrap">
              <table className="drill-table">
                <thead>
                  <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {answer.result.map((row, idx) => (
                    <tr key={idx}>{headers.map((h) => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {error && <div className="card error">{error}</div>}
    </section>
  );
}
