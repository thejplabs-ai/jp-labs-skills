---
name: grill
description: Grill the user relentlessly about a plan, decision, or idea until reaching shared understanding, resolving each branch of the decision tree. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases ("me entrevista", "vamos pensar antes de fazer", "grill").
---

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a *fact* can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer.

Do not act on it until I confirm we have reached a shared understanding.

Ask every question through the AskUserQuestion tool, never as plain chat text. Put the full context in the tool itself (what you found, the trade-offs, why you recommend it); the recommended option goes first with "(Recommended)". When the options are concrete artifacts (copy, layout, config), show each one in the option's `preview`.
