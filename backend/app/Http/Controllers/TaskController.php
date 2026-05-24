<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\Project;
use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Carbon\Carbon;

class TaskController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:tarea,pendiente,en_proceso,finalizado',
        ]);

        $project = Project::find($request->project_id);

        // Validar propiedad del proyecto
        if ($project->user_id !== auth()->id()) {
            return response()->json(['message' => 'No autorizado para agregar tareas a este proyecto.'], 403);
        }

        $task = Task::create([
            'project_id' => $request->project_id,
            'title' => $request->title,
            'description' => $request->description,
            'status' => $request->status ?? 'tarea',
            'time_logged' => 0,
        ]);

        return response()->json($task->load('timeEntries'), 201);
    }

    public function update(Request $request, Task $task)
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:tarea,pendiente,en_proceso,finalizado',
            'time_logged' => 'nullable|integer',
        ]);

        // Validar propiedad del proyecto
        if ($task->project->user_id !== auth()->id()) {
            return response()->json(['message' => 'No autorizado para modificar esta tarea.'], 403);
        }

        $task->update($request->only(['title', 'description', 'status', 'time_logged']));

        return response()->json($task->load('timeEntries'));
    }

    public function logTime(Request $request, Task $task)
    {
        $request->validate([
            'seconds' => 'required|integer|min:0',
            'start_time' => 'nullable|date',
            'end_time' => 'nullable|date',
            'comment' => 'nullable|string',
        ]);

        // Validar propiedad del proyecto
        if ($task->project->user_id !== auth()->id()) {
            return response()->json(['message' => 'No autorizado para registrar tiempo en esta tarea.'], 403);
        }

        // Acumular tiempo
        $task->time_logged += $request->seconds;
        $task->save();

        // Registrar entrada de tiempo detallada con comentario
        $entry = TimeEntry::create([
            'task_id' => $task->id,
            'start_time' => $request->start_time ? Carbon::parse($request->start_time) : now()->subSeconds($request->seconds),
            'end_time' => $request->end_time ? Carbon::parse($request->end_time) : now(),
            'duration' => $request->seconds,
            'comment' => $request->comment,
        ]);

        return response()->json([
            'task' => $task->load('timeEntries'),
            'entry' => $entry
        ]);
    }

    public function destroy(Task $task)
    {
        // Validar propiedad del proyecto
        if ($task->project->user_id !== auth()->id()) {
            return response()->json(['message' => 'No autorizado para eliminar esta tarea.'], 403);
        }

        $task->delete();
        return response()->json(['message' => 'Tarea eliminada con éxito.']);
    }
}
