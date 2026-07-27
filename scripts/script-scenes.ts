function repairText(value: string): string {
  return value
    .replace(/â€”|â€“/g, "—")
    .replace(/â€™|â€˜/g, "’")
    .replace(/â€œ|â€/g, "\"")
    .replace(/Â£/g, "£")
    .replace(/âœ“/g, "✓")
    .replace(/\uFFFD/g, "");
}

export function splitScript(script: string): string[] {
  const clean = repairText(script).trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ");
  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter((part) => /[a-z0-9]/i.test(part)) ?? [];
  const beats = sentences.flatMap((sentence) => {
    if (sentence.split(/\s+/).length <= 15) return [sentence];
    const clauses = sentence.split(/(?<=,|;)\s+|\s+(?=(?:but|while|because|causing|particularly|as a result)\b)/i).map((part) => part.trim()).filter(Boolean);
    if (clauses.length > 1) return clauses;
    const words = sentence.split(/\s+/);
    const target = Math.ceil(words.length / 2);
    const semanticBreak = words.findIndex((word, index) => index >= target - 2 && /^(but|and|before|after|while|because|only)$/i.test(word));
    const midpoint = semanticBreak > 2 ? semanticBreak : target;
    return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
  });
  return beats.reduce<string[]>((result, beat) => {
    if (beat.split(/\s+/).length < 3 && result.length) result[result.length - 1] = `${result[result.length - 1]} ${beat}`;
    else result.push(beat);
    return result;
  }, []);
}
