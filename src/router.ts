import { ResponseContainer, Response } from "@ant/framework";
import { Express, Response as ExpressResponse } from "express";
import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import express from "express";

export interface ViewResponse extends Response {
    view: string;
}

export class ViewContainer extends ResponseContainer implements ViewResponse {

    public view!: string;
    public data?: any

    setView(view: string): Response {
        this.view = view;

        return this;
    }

    getView(): string {
        return this.view;
    }

    render(response: ExpressResponse): void {
        return response
            .status(this.getStatus())
            .header(this.getHeaders())
            .render(this.getView(), this.getData() as object);
    }
}

export function view(view: string, data?: object, code: number = 200) {
    return (new ViewContainer)
        .setView(view)
        .setData(data)
        .setStatus(code)
        ;
}

export type Renderer = (path: string, options: object, callback: (e: any, rendered?: string) => void) => void;

export type EngineOptions = {
    extname?: string;
    layoutsDir?: string;
    defaultLayout?: string;
    partialsDir?: string;
}

export function engine(config?: EngineOptions): Renderer {
    if (config?.partialsDir) {
        for (const partial of fs.readdirSync(config.partialsDir)) {
            if (partial.endsWith(".hbs")) {
                Handlebars.registerPartial(partial.replace(".hbs", ""), Handlebars.compile(fs.readFileSync(path.join(config.partialsDir, partial)).toString()));
            }
        }
    }
    const layouts: Record<string, string> = {};

    if (config?.layoutsDir) {
        for (const file of fs.readdirSync(config.layoutsDir)) {
            if (file.endsWith(".hbs")) {
                const name = file.replace(".hbs", "");
                layouts[name] = path.join(config.layoutsDir, file);
            }
        }

    }

    Handlebars.registerHelper({
        eq: (v1, v2) => v1 === v2,
        ne: (v1, v2) => v1 !== v2,
        lt: (v1, v2) => v1 < v2,
        gt: (v1, v2) => v1 > v2,
        lte: (v1, v2) => v1 <= v2,
        gte: (v1, v2) => v1 >= v2,
        and() {
            return Array.prototype.every.call(arguments, Boolean);
        },
        or() {
            return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
        }
    });

    return (
        view: string,
        options: any,
        callback: (e: any, rendered?: string) => void
    ) => {
        console.log("layout", layouts);

        Handlebars.registerPartial("body", Handlebars.compile(fs.readFileSync(view).toString(), options));

        fs.readFile(layouts[options.layout] ?? layouts[config?.defaultLayout as string], (error, file) => {
            if (error) {
                return callback(error);
            }

            const template = Handlebars.compile(file.toString(), options);

            const rendered = template(options);

            return callback(null, rendered);
        });
    }
}

export function overrideRouter(router: Express, options: EngineOptions): Express {
    return router
        .use(express.static(path.join(__dirname, '../../public')))
        .set('view engine', 'hbs')
        .set('views', path.join(__dirname, '../views'))
        .engine("hbs", engine(options))
    ;
}
