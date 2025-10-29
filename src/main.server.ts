import '@angular/platform-server/init';
import 'zone.js/node';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config as serverConfig } from './app/app.config.server';

export default function bootstrap() {
  return bootstrapApplication(AppComponent, serverConfig);
}
