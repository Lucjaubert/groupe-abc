import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config as serverConfig } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, serverConfig);

export default bootstrap;
