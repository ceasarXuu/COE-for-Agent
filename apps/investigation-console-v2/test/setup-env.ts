// Pin the BFF default actor for unit tests so existing assertions about
// `actorId: 'console-reviewer'` remain stable even after H-1 made the
// production default depend on the OS user and CONSOLE_LOCAL_* envs.
process.env.CONSOLE_LOCAL_ACTOR_ID = 'console-reviewer';
process.env.CONSOLE_LOCAL_ROLE = 'Reviewer';
