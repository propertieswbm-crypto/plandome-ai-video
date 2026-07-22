export function splitScript(script: string): string[] {
  const clean = script.trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ");
  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter((part) => /[a-z0-9]/i.test(part)) ?? [];
  const beats = sentences.flatMap((sentence) => {
    if (sentence.split(/\s+/).length <= 15) return [sentence];
    const clauses = sentence.split(/(?<=,|;)\s+|\s+(?=(?:but|while|because|causing|particularly|as a result)\b)/i).map((part) => part.trim()).filter(Boolean);
    if (clauses.length > 1) return clauses;
    const words = sentence.split(/\s+/); const midpoint = Math.ceil(words.length / 2);
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
  });
  return beats.reduce<string[]>((result, beat) => {
    if (beat.split(/\s+/).length < 3 && result.length) result[result.length - 1] = `${result[result.length - 1]} ${beat}`;
    else result.push(beat);
    return result;
  }, []);
}
