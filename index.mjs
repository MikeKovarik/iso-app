import app from './src/app.mjs'

import Window from './src/window.mjs'
import Ipc from './src/ipc.mjs'
import Theme from './src/theme.mjs'

app._importPlugin(Window)
app._importPlugin(Ipc)
//app._importPlugin(Theme)

export default app