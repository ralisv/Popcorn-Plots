declare module "d3-regression" {
  export type Point = [number, number];

  export interface RegressionGenerator<T = Point> {
    (data: T[]): Point[];
    domain(): [number, number] | undefined;
    domain(domain: [number, number]): this;
    x(): (d: T) => number;
    x<U>(x: (d: U) => number): RegressionGenerator<U>;
    y(): (d: T) => number;
    y(y: (d: T) => number): this;
  }

  export interface PolynomialRegressionGenerator<T = Point>
    extends RegressionGenerator<T> {
    order(): number;
    order(order: number): this;
    x<U>(x: (d: U) => number): PolynomialRegressionGenerator<U>;
  }

  export interface LoessRegressionGenerator<T = Point>
    extends RegressionGenerator<T> {
    bandwidth(): number;
    bandwidth(bandwidth: number): this;
    x<U>(x: (d: U) => number): LoessRegressionGenerator<U>;
  }

  export function regressionLinear<T = Point>(): RegressionGenerator<T>;
  export function regressionExp<T = Point>(): RegressionGenerator<T>;
  export function regressionLog<T = Point>(): RegressionGenerator<T>;
  export function regressionPow<T = Point>(): RegressionGenerator<T>;
  export function regressionQuad<T = Point>(): RegressionGenerator<T>;
  export function regressionPoly<T = Point>(): PolynomialRegressionGenerator<T>;
  export function regressionLoess<T = Point>(): LoessRegressionGenerator<T>;
}
