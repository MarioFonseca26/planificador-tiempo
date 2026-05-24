<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index()
    {
        // Retornar los proyectos que pertenecen al usuario autenticado con sus tareas e historial
        return response()->json(auth()->user()->projects()->with('tasks.timeEntries')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $project = Project::create([
            'user_id' => auth()->id(),
            'name' => $request->name,
            'description' => $request->description,
        ]);

        return response()->json($project->load('tasks.timeEntries'), 201);
    }

    public function destroy(Project $project)
    {
        // Validar propiedad del proyecto
        if ($project->user_id !== auth()->id()) {
            return response()->json(['message' => 'No autorizado para eliminar este proyecto.'], 403);
        }

        $project->delete();
        return response()->json(['message' => 'Proyecto eliminado con éxito.']);
    }
}
