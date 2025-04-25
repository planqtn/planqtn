import sys
from drawsvg import *
import abc
from attrs import define
import numpy as np
from typing import Any, List, Tuple

from qlego.legos import Legos
from server.api_types import TensorNetworkResponse


@define(frozen=True)
class Point:
    x: float
    y: float

    def copy(self):
        return Point(np.round(self.x, 5), np.round(self.y, 5))

    def __neg__(self):
        return Point(-self.x, -self.y)

    def __add__(self, other):
        return Point(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Point(self.x - other.x, self.y - other.y)

    def __truediv__(self, f):
        return Point(self.x / f, self.y / f)

    def __hash__(self) -> int:
        return hash((self.x, self.y))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Point):
            return False
        return np.allclose([self.x, self.y], [other.x, other.y], atol=1e-5)

    def dot(self, other: "Point") -> float:
        return self.x * other.x + self.y * other.y

    def __mul__(self, other: "Point") -> float:
        return self.dot(other)

    def __rmul__(self, other: float) -> "Point":
        return Point(self.x * other, self.y * other)


class Transformation(abc.ABC):
    @abc.abstractmethod
    def __call__(self, point: Point) -> Point:
        pass

    def then(self, other: "Transformation") -> "Transformation":
        return Transformations([self, other])

    def scale_factor(self) -> float:
        return 1.0


class Translation(Transformation):
    def __init__(self, translation: Point):
        self.translation = translation

    def __call__(self, point: Point) -> Point:
        return point + self.translation


class Rotation(Transformation):
    def __init__(self, angle: float):
        self.angle = angle

    def __call__(self, point: Point) -> Point:
        return Point(
            point.x * np.cos(self.angle) - point.y * np.sin(self.angle),
            point.x * np.sin(self.angle) + point.y * np.cos(self.angle),
        )


class Reflection(Transformation):
    def __init__(self, axis: Point):
        self.axis = axis

    def __call__(self, point: Point) -> Point:
        return Point(
            point.x * np.cos(self.angle) - point.y * np.sin(self.angle),
            point.x * np.sin(self.angle) + point.y * np.cos(self.angle),
        )


class Identity(Transformation):
    def __call__(self, point: Point) -> Point:
        return point


class Scale(Transformation):
    def __init__(self, scale: float):
        self.scale = scale

    def __call__(self, point: Point) -> Point:
        return Point(point.x * self.scale, point.y * self.scale)

    def scale_factor(self) -> float:
        return self.scale


class Transformations(Transformation):
    def __init__(self, transformations: List[Transformation] = [Identity()]):
        self.transformations = transformations

    def __call__(self, point: Point) -> Point:
        for transformation in self.transformations:
            point = transformation(point)
        return point

    def then(self, other: "Transformation") -> "Transformation":
        return Transformations(self.transformations + [other])

    def rotate(self, angle: float) -> "Transformation":
        return self.then(Rotation(angle))

    def translate(self, offset: Point) -> "Transformation":
        return self.then(Translation(offset.copy()))

    def reflect(self, center_of_reflection: Point) -> "Transformation":
        return self.then(Reflection(center_of_reflection))

    def scale(self, factor: float) -> "Transformation":
        return self.then(Scale(factor))

    def scale_factor(self) -> float:
        return np.prod([t.scale_factor() for t in self.transformations])


class Tile(abc.ABC, Path):
    def __init__(
        self,
        x,
        y,
        n,
        user_args={},
    ):

        self.n = n

        points, self.center = self.calculate_points(Point(x, y))
        translate_to_center = Translation(Point(x, y) - self.center)
        self.x = x
        self.y = y
        self.center = Point(x, y)

        arg_defaults = {
            "stroke_width": 1,
            "stroke": "black",
            "fill_opacity": 1,
            "fill": "green",
        }
        arg_defaults.update(user_args)
        self.user_args = user_args
        self.args = arg_defaults

        super().__init__(**arg_defaults)

        self.points = [translate_to_center(p) for p in points]

    def draw(self, d: Drawing):
        self.M(self.points[0].x, self.points[0].y)

        num_points = len(self.points)
        for i in range(1, num_points + 1):
            self.L(self.points[i % num_points].x, self.points[i % num_points].y)
        d.append(self)

    def rotate_by_center(self, angle: float) -> "Tile":

        res = self.transform(
            Transformations()
            .translate(-self.center)
            .rotate(angle)
            .translate(self.center)
        )

        return res

    def scale_by_center(self, scale: float) -> "Tile":

        return self.transform(
            Transformations()
            .translate(-self.center.copy())
            .scale(scale)
            .translate(self.center)
        )

    @abc.abstractmethod
    def calculate_points(self, starting_point: Point) -> Tuple[List[Point], Point]:
        pass

    @abc.abstractmethod
    def transform(self, transformation: Transformation) -> "Tile":
        pass


class RegularPolygon(Tile):
    def __init__(
        self,
        x,
        y,
        side,
        n,
        user_args={},
    ):
        self.side = side

        super().__init__(x, y, n, user_args)

    def calculate_points(self, starting_point: Point) -> Tuple[List[Point], Point]:
        curr_point = starting_point
        # self.M(self(-1).x, self(-1).y)
        points = []
        for i in range(self.n):
            points.append(curr_point.copy())
            angle = i * 2 * np.pi / self.n
            curr_point += Point(self.side * np.cos(angle), self.side * np.sin(angle))
        return points, np.average(points)

    def arg(self, **kwargs) -> "RegularPolygon":
        new_args = self.user_args.copy()
        new_args.update(kwargs)
        res = RegularPolygon(
            self.x,
            self.y,
            self.side,
            self.n,
            new_args,
        )
        res.center = self.center.copy()
        res.points = self.points.copy()
        return res

    def edges(self) -> List[Tuple[Point, Point]]:
        return [
            (self.points[i], self.points[(i + 1) % len(self.points)])
            for i in range(len(self.points))
        ]

    def transform(self, transformation: Transformation) -> "Tile":
        res = RegularPolygon(
            self.x,
            self.y,
            self.side,
            self.n,
            self.user_args,
        )
        res.points = [transformation(p) for p in self.points]
        res.center = transformation(res.center)
        res.x = res.center.x
        res.y = res.center.y
        res.side = self.side * transformation.scale_factor()
        return res


def deflate_pentagon(
    parent: RegularPolygon, center_color, edge_color
) -> List[RegularPolygon]:
    res: List[RegularPolygon] = []
    golden_ratio = (1 + np.sqrt(5)) / 2

    res.append(
        parent.rotate_by_center(np.pi / 5)
        .scale_by_center(1 / (1 + golden_ratio))
        .arg(fill=center_color)
    )

    for edge in res[0].edges():
        edge_center = np.average(edge)

        edge_child = (
            res[0]
            .rotate_by_center(np.pi / 5)
            .transform(Translation(2 * (edge_center - res[0].center)))
            .arg(fill=edge_color)
        )
        res.append(edge_child)

    return res


def deflation(
    parents: List[RegularPolygon], center_color: str, edge_color: str
) -> List[RegularPolygon]:
    children = []
    for parent in parents:
        children.extend(deflate_pentagon(parent, center_color, edge_color))
    return children


def get_adjacency_list(
    children: List[RegularPolygon],
) -> Tuple[List[Point], List[Tuple[Point, Point]]]:
    edges = []
    vertices = []
    for tile in children:
        for edge in tile.edges():
            if edge[0] not in vertices:
                vertices.append(edge[0])
            if edge[1] not in vertices:
                vertices.append(edge[1])
            if edge not in edges and edge[::-1] not in edges:
                edges.append(edge)

    return vertices, edges


def get_lego_list(vertices, edges, start_node_index: int = 0):
    print("START NODE INDEX", start_node_index)
    z_spiders = [
        {
            "id": "z_rep_code",
            "instanceId": str(instance_id + start_node_index),
            "x": vertex.x,
            "y": vertex.y,
            "n_legs": 0,
            "shortName": "Z",
        }
        for instance_id, vertex in enumerate(vertices)
    ]
    h_spiders = []
    connections = []
    instance_id = len(z_spiders)
    for edge in edges:
        instance_id += 1
        h_id = str(instance_id + start_node_index)
        edge_center = np.average(edge)
        h_spiders.append(
            {
                "id": "h",
                "instanceId": h_id,
                "parity_check_matrix": [[1, 0, 0, 1], [0, 1, 1, 0]],
                "shortName": "H",
                "x": edge_center.x,
                "y": edge_center.y,
            }
        )
        v1 = vertices.index(edge[0])
        v2 = vertices.index(edge[1])

        connections.append(
            {
                "from": {
                    "legoId": str(v1 + start_node_index),
                    "legIndex": z_spiders[v1]["n_legs"],
                },
                "to": {
                    "legoId": h_id,
                    "legIndex": 0,
                },
            }
        )
        connections.append(
            {
                "from": {
                    "legoId": str(v2 + start_node_index),
                    "legIndex": z_spiders[v2]["n_legs"],
                },
                "to": {
                    "legoId": h_id,
                    "legIndex": 1,
                },
            }
        )
        print(
            v1,
            "[" + str(z_spiders[v1]["n_legs"]) + "] -> [0] ",
            h_id,
            "[1] -> ",
            v2,
            "[" + str(z_spiders[v2]["n_legs"]) + "]",
        )
        z_spiders[v1]["n_legs"] += 1
        z_spiders[v2]["n_legs"] += 1

    for i, z_spider in enumerate(z_spiders):
        if z_spider["n_legs"] == 2:
            z_spider["n_legs"] = 3

        z_spider["parity_check_matrix"] = Legos.z_rep_code(z_spider["n_legs"]).tolist()

    return z_spiders + h_spiders, connections


def get_pentaflake_network(
    level: int, start_node_index: int = 0
) -> TensorNetworkResponse:
    print("==============================")
    w = 1000
    h = 1000
    d = Drawing(w, h)
    parent = RegularPolygon(
        w / 2, h / 2, w * 0.5, 5, user_args={"fill": "orange"}
    ).rotate_by_center(np.pi / 5)

    tiles = [parent]
    children = tiles
    for _ in range(level):
        children = deflation(children, "green", "green")
        tiles.extend(children)

    print(len(tiles), "tiles, calculating adjacency list")
    vertices, edges = get_adjacency_list(tiles)

    print(len(edges), "edges,", len(vertices), "vertices")

    for edge in edges:
        d.append(Line(edge[0].x, edge[0].y, edge[1].x, edge[1].y, stroke="red"))

    # for vertex in vertices:
    #     d.append(Circle(vertex.x, vertex.y, 3, stroke="blue"))

    legos, connections = get_lego_list(vertices, edges, start_node_index)

    for lego in legos:
        d.append(
            Text(
                text=str(lego["n_legs"]) if "n_legs" in lego else "H",
                x=lego["x"],
                y=lego["y"],
                font_size=16,
                stroke="white",
            )
        )

    # for tile in tiles:
    #     tile.draw(d)

    d.save_svg("test.svg")
    print("done")

    return TensorNetworkResponse(legos=legos, connections=connections)
