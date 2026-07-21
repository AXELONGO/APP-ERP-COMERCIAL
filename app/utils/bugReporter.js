async function reportBug({ level, message, error }) {
  console.error(`[BugReporter] ${level}: ${message}`);
}

module.exports = { reportBug };